"""v0.8: Berechnung, Datenqualität, unveränderliche Exporte und lokale Versandwarteschlange."""
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.request
import unittest
import time
import uuid
import zipfile
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from test_api import Client as BaseClient, BASE, MAIL, NEW_PASSWORD
import test_v07 as legacy
UTC=dt.timezone.utc
START=dt.datetime(2023,12,31,23,tzinfo=UTC)
REFEND=dt.datetime(2024,1,31,23,tzinfo=UTC)
BEGIN=dt.datetime(2024,12,31,23,tzinfo=UTC)
END=dt.datetime(2025,1,31,23,tzinfo=UTC)
class Client(BaseClient):
    # Der Gesamtlauf bleibt unter dem echten Login-Schutz. Keine Produktionsgrenze abschalten.
    def req(self, path, method='GET', data=None, csrf=True):
        for attempt in range(3):
            result=super().req(path,method,data,csrf)
            if result[0]!=429 or not path.startswith('/api/auth/') or attempt==2:return result
            time.sleep(30)

class ProfessionalV08(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=Client();assert cls.admin.login('admin@sysdatiq.local',NEW_PASSWORD)[0]==200
        legacy.AnalyticsIntegration.admin=cls.admin
    def setUp(self):
        self.t=legacy.AnalyticsIntegration();self.t.setUp();self.customer=self.t.customer;self.cid=self.customer['id']
    def req(self,path,method='GET',data=None):return self.admin.req(path,method,data)
    def analysis(self,**kwargs):
        body={'from':'2025-01-01','to':'2025-01-31','compareFrom':'2024-01-01','compareTo':'2024-01-31'};body.update(kwargs)
        return self.req('/api/analysis/'+self.cid,'POST',body)
    def measured(self,**values):
        p=self.t.meter(at=START,initial=0,**values)
        for at,value in [(REFEND,100),(BEGIN,200),(END,400)]:self.t.read(p,at,value)
        return p
    def definition(self,**values):
        body={'name':'Professioneller Bericht ÄÖÜ','from':'2025-01-01','to':'2025-01-31','siteId':self.t.site['id']};body.update(values)
        code,r=self.req('/api/reports/'+self.cid+'/','POST',body);self.assertEqual(code,201,r);return r
    def generate(self,d,**extra):return self.req('/api/reports/'+self.cid+'/generated/'+d['id'],'POST',{'version':d['version'],**extra})
    def raw(self,id,ext):
        with self.admin.open.open(BASE+'/api/reports/'+self.cid+'/generated/'+id+'/'+ext,timeout=60) as r:return r.read()
    def user(self,restricted=None):
        email=uuid.uuid4().hex+'@example.test';code,u=self.req('/api/users/','POST',{'name':'Prüfbenutzer','email':email,'role':'CustomerUser','customerIds':[self.cid]});self.assertEqual(code,201,u)
        if restricted is not None:self.assertEqual(self.req('/api/users/'+u['id']+'/site-access','PUT',{'customerId':self.cid,'restricted':True,'siteIds':restricted})[0],200)
        client=Client();self.assertEqual(client.login(email,'Start_Energie')[0],200);self.assertEqual(client.change()[0],200);return u,client
    def reminder(self,user,**values):
        body={'enabled':True,'day':1,'hour':9,'minute':0,'followUpDays':7,'timeZone':'Europe/Berlin','userIds':[user['id']],'version':1};body.update(values)
        return self.req('/api/reminders/'+self.cid+'/','PUT',body)
    def test_01_comparison_factors_roots_units_and_denominators(self):
        p=self.measured(factor=2);self.measured(parentPointId=p['id']);self.measured(medium='Water',unit='m³')
        code,r=self.analysis(areaM2=100,referenceAreaM2=50,operatingHours=10,referenceOperatingHours=20,productionUnits=5,referenceProductionUnits=10,denominatorSource='Flächenplan und BDE beider Zeiträume');self.assertEqual(code,200,r)
        x=next(x for x in r['comparisons'] if x['medium']=='Electricity');self.assertEqual(x['current'],400);self.assertEqual(x['reference'],200);self.assertEqual(x['changePercent'],100);self.assertEqual(x['perArea'],4);self.assertEqual(x['referencePerHour'],10);self.assertEqual(x['perProductionUnit'],80)
        self.assertEqual(len(r['current']['groups']),2);self.assertEqual(r['current']['groups'][0]['coverage'],1);self.assertEqual(len(r['current']['rootPeriods']),2)
        self.assertTrue(all(x['source']=='Manual' for x in r['current']['readings']))
    def test_02_gaps_not_zero_and_partial_known_amount(self):
        p=self.t.meter(at=BEGIN);self.t.read(p,BEGIN+dt.timedelta(days=10),50)
        code,r=self.analysis();self.assertEqual(code,200,r);g=r['current']['groups'][0]
        self.assertIsNone(g['value']);self.assertEqual(g['available'],50);self.assertLess(g['coverage'],1);self.assertIsNone(r['comparisons'][0]['changePercent']);self.assertTrue(r['current']['quality'][0]['overdue'])
    def test_03_interpolation_zero_and_explicit_limits(self):
        p=self.measured();code,r=self.analysis(**{'from':'2025-01-05','to':'2025-01-10'});self.assertEqual(code,200,r);self.assertTrue(r['current']['groups'][0]['estimated']);self.assertAlmostEqual(r['current']['groups'][0]['value'],200*6/31,places=5)
        zero=self.t.meter(at=BEGIN);self.t.read(zero,END,0);code,r=self.analysis();self.assertEqual(code,200,r);self.assertTrue(all(x['openChecks']==0 for x in r['current']['quality']))
    def test_04_quality_ack_and_correction_reopen(self):
        p=self.t.meter(at=BEGIN,maxDailyConsumption=1);row=self.t.read(p,END,100,confirmWarning=True,reason='Bewusst bestätigter Testfall')
        code,r=self.analysis();self.assertEqual(code,200,r);self.assertEqual(r['current']['quality'][0]['openChecks'],1)
        path='/api/quality/readings/'+row['id']+'/review';self.assertEqual(self.req(path,'POST',{'version':1,'reason':'Vergleich mit Foto geprüft'})[0],200)
        self.assertEqual(self.analysis()[1]['current']['quality'][0]['openChecks'],0)
        code,changed=self.req('/api/meters/'+p['id']+'/readings/'+row['id'],'PUT',{'at':legacy.iso(END),'value':101,'version':1,'reason':'Korrigierter Fotowert','confirmWarning':True});self.assertEqual(code,200,changed)
        self.assertEqual(self.analysis()[1]['current']['quality'][0]['openChecks'],1)
        self.assertEqual(self.req(path,'POST',{'version':1,'reason':'Veraltete Prüfung'})[0],409)
        self.assertEqual(self.req(path,'POST',{'version':2,'reason':'Auch korrigierten Stand nachgeprüft'})[0],200)
        self.assertEqual(self.analysis()[1]['current']['quality'][0]['openChecks'],0)
    def test_05_validation_access_and_scope(self):
        self.measured()
        for values in [{'from':'2025-02-01'},{'compareFrom':'2025-02-01'},{'areaM2':0},{'areaM2':10},{'medium':'INVALID'},{'from':'1900-01-01'},{'compareTo':None}]:self.assertEqual(self.analysis(**values)[0],400,values)
        outside=Client();outside.login('lesen@weserpark.example',NEW_PASSWORD);self.assertEqual(outside.req('/api/analysis/'+self.cid,'POST',{'from':'2025-01-01','to':'2025-01-31'})[0],404)
        hidden=self.t.node('Site');hidden_b=self.t.node('Building',hidden);self.measured(node=hidden_b)
        _,reader=self.user([self.t.site['id']]);code,r=reader.req('/api/analysis/'+self.cid,'POST',{'from':'2025-01-01','to':'2025-01-31'});self.assertEqual(code,200,r);self.assertEqual(len(r['current']['quality']),1);self.assertNotIn(hidden['id'],r['requiredSites'])
    def test_06_report_files_freeze_release_and_new_version(self):
        p=self.measured(factor=2);d=self.definition();code,r=self.generate(d);self.assertEqual(code,201,r)
        snapshot=self.raw(r['id'],'snapshot');self.assertEqual(hashlib.sha256(snapshot).hexdigest().upper(),r['snapshotHash']);self.assertEqual(json.loads(snapshot)['analysis']['comparisons'][0]['current'],400)
        pdf=self.raw(r['id'],'pdf');xlsx=self.raw(r['id'],'xlsx');self.assertTrue(pdf.startswith(b'%PDF-'));self.assertTrue(xlsx.startswith(b'PK'))
        with zipfile.ZipFile(io.BytesIO(xlsx)) as z:
            workbook=z.read('xl/workbook.xml').decode();self.assertIn('Datenqualität',workbook);self.assertIn('Rohdaten Aktuell',workbook);self.assertNotIn(b'<f>',z.read('xl/worksheets/sheet2.xml'))
            root=ET.fromstring(z.read('xl/worksheets/sheet2.xml'));ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};self.assertEqual(root.find('.//s:c[@r="D2"]/s:v',ns).text,'400')
        path='/api/reports/'+self.cid+'/generated/'+r['id']
        code,released=self.req(path+'/release','POST',{'version':1,'reason':'Vollständig geprüft und freigegeben'});self.assertEqual(code,200,released);self.assertEqual(released['sequence'],2);self.assertEqual(released['snapshotHash'],r['snapshotHash']);self.assertEqual(self.req(path+'/release','POST',{'version':1,'reason':'Nicht doppelt freigeben'})[0],409)
        row=next(x['reading'] for x in self.req('/api/meters/'+p['id'])[1]['readings'] if x['reading']['at'].startswith('2025-01-31'))
        self.assertEqual(self.req('/api/meters/'+p['id']+'/readings/'+row['id'],'PUT',{'at':legacy.iso(END),'value':500,'version':row['version'],'reason':'Nachträglich korrigierter Stand'})[0],200)
        self.assertEqual(self.raw(r['id'],'pdf'),pdf);self.assertEqual(self.raw(r['id'],'xlsx'),xlsx);self.assertEqual(self.raw(r['id'],'snapshot'),snapshot)
        code,new=self.generate(d);self.assertEqual(code,201,new);self.assertEqual(new['sequence'],3);self.assertNotEqual(new['snapshotHash'],r['snapshotHash']);self.assertEqual(json.loads(self.raw(new['id'],'snapshot'))['analysis']['comparisons'][0]['current'],600)
        out=Path('../artifacts/v08');out.mkdir(parents=True,exist_ok=True);(out/'bericht.pdf').write_bytes(pdf);(out/'bericht.xlsx').write_bytes(xlsx);(out/'snapshot.json').write_bytes(snapshot)
    def test_07_report_scope_revocation_and_deleted_template(self):
        self.measured();d=self.definition();code,r=self.generate(d);self.assertEqual(code,201,r);u,reader=self.user([self.t.site['id']]);path='/api/reports/'+self.cid+'/generated/'
        self.assertEqual(reader.req(path+r['id']+'/snapshot')[0],200);self.assertEqual(reader.req(path+d['id'],'POST',{'version':1})[0],403)
        self.req('/api/users/'+u['id']+'/site-access','PUT',{'customerId':self.cid,'restricted':True,'siteIds':[]})
        self.assertEqual(reader.req(path+r['id']+'/snapshot')[0],404);self.assertEqual(reader.req(path)[1],[])
        self.assertEqual(self.req('/api/reports/'+self.cid+'/'+d['id'],'DELETE',{'version':1,'reason':'Vorlage nicht mehr benötigt'})[0],200);self.assertEqual(self.req(path+r['id']+'/snapshot')[0],200)
    def test_08_format_selection_and_no_formula_execution(self):
        self.measured();d=self.definition(name='=HYPERLINK("https://example.invalid")',pdf=False,includeReadings=False,includeTheory=False);code,r=self.generate(d);self.assertEqual(code,201,r);self.assertFalse(r['pdf']);self.assertTrue(r['excel']);self.assertEqual(self.req('/api/reports/'+self.cid+'/generated/'+r['id']+'/pdf')[0],404)
        with zipfile.ZipFile(io.BytesIO(self.raw(r['id'],'xlsx'))) as z:
            self.assertNotIn('Rohdaten',z.read('xl/workbook.xml').decode());self.assertNotIn(b'<f>',z.read('xl/worksheets/sheet1.xml'))
    def test_09_reminder_default_disabled_validation_and_permissions(self):
        self.measured();u,client=self.user();path='/api/reminders/'+self.cid
        self.assertFalse(self.req(path+'/')[1]['setting']['enabled']);self.assertEqual(client.req(path+'/')[0],403)
        for values in [{'day':31},{'timeZone':'Unknown/Zone'},{'userIds':[]},{'version':9}]:self.assertIn(self.reminder(u,**values)[0],[400,409])
        code,s=self.reminder(u);self.assertEqual(code,200,s);self.assertGreater(dt.datetime.fromisoformat(s['nextDueAt']),dt.datetime.now(UTC));self.assertEqual(self.reminder(u)[0],409)
    def test_10_reminder_outbox_mailpit_and_duplicate_prevention(self):
        self.measured();u,client=self.user([self.t.site['id']]);self.assertEqual(self.reminder(u)[0],200);path='/api/reminders/'+self.cid
        self.assertEqual(self.req(path+'/plan','POST')[1]['planned'],2);self.assertEqual(self.req(path+'/plan','POST')[1]['planned'],0)
        self.assertEqual(self.req(path+'/process','POST')[1]['sent'],1);self.assertEqual(self.req(path+'/process','POST')[1]['sent'],0)
        jobs=self.req(path+'/')[1]['jobs'];self.assertEqual(sum(j['status']=='Sent' for j in jobs),1);self.assertEqual(sum(j['status']=='Pending' for j in jobs),1)
        job=next(j for j in jobs if j['status']=='Sent');self.assertEqual(job['attempts'],1)
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}));messages=json.load(opener.open(MAIL+'/api/v1/search?query='+urllib.parse.quote('to:'+u['email'])))['messages'];self.assertEqual(len(messages),1)
        message=json.load(opener.open(MAIL+'/api/v1/message/'+messages[0]['ID']));self.assertIn(job['id'],message['Text']);self.assertIn('readings=1',message['Text'])
    def test_11_reminder_revoked_user_cancel_and_audit(self):
        self.measured();u,client=self.user();self.reminder(u,followUpDays=0);path='/api/reminders/'+self.cid;self.assertEqual(self.req(path+'/plan','POST')[1]['planned'],1)
        self.req('/api/users/'+u['id']+'/site-access','PUT',{'customerId':self.cid,'restricted':True,'siteIds':[]})
        self.assertEqual(self.req(path+'/process','POST')[1]['sent'],0);self.assertEqual(self.req(path+'/')[1]['jobs'][0]['status'],'Cancelled')
        events=self.req('/api/audit?customerId='+self.cid)[1];self.assertTrue(any(e['action']=='Erinnerung.Konfiguriert' for e in events))
    def test_12_parallel_generation_conflict_or_unique_sequences(self):
        self.measured();d=self.definition(pdf=False);clients=[Client(),Client()]
        for c in clients:self.assertEqual(c.login('admin@sysdatiq.local',NEW_PASSWORD)[0],200)
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda c:c.req('/api/reports/'+self.cid+'/generated/'+d['id'],'POST',{'version':1}),clients))
        self.assertTrue(all(code in [201,409] for code,_ in results),results);seq=[r['sequence'] for code,r in results if code==201];self.assertEqual(len(seq),len(set(seq)));self.assertTrue(seq)
    def test_13_calendar_timezone_dst_and_known_zero(self):
        a=dt.datetime(2024,2,29,23,tzinfo=UTC);b=dt.datetime(2024,3,31,22,tzinfo=UTC)
        p=self.t.meter(at=a);self.t.read(p,b,743)
        code,r=self.analysis(**{'from':'2024-03-01','to':'2024-03-31','compareFrom':'2023-03-01','compareTo':'2023-03-31'});self.assertEqual(code,200,r)
        g=r['current']['groups'][0];self.assertEqual(g['value'],743);self.assertAlmostEqual(g['days'],743/24,places=10);self.assertAlmostEqual(r['comparisons'][0]['currentPerDay'],24,places=10)
        zero=self.t.meter(at=BEGIN);self.t.read(zero,END,0)
        code,r=self.analysis();self.assertEqual(code,200,r);zeroq=next(x for x in r['current']['quality'] if x['pointId']==zero['id']);self.assertEqual(zeroq['coverage'],1)
    def test_14_incomplete_replacement_has_no_invented_delta(self):
        p=self.t.meter(at=BEGIN);self.t.read(p,BEGIN+dt.timedelta(days=5),20);at=BEGIN+dt.timedelta(days=10)
        point=self.req('/api/meters/'+p['id'])[1]['point'];code,r=self.req('/api/meters/'+p['id']+'/replacement','POST',{'at':legacy.iso(at),'oldEndValue':None,'newStartValue':None,'confirmIncomplete':True,'device':{'number':'NEW-'+uuid.uuid4().hex},'reason':'Fehlende Austauschstände dokumentiert','version':point['version']});self.assertEqual(code,200,r)
        self.t.read(p,at+dt.timedelta(days=2),100);self.t.read(p,END,140)
        code,r=self.analysis();self.assertEqual(code,200,r);self.assertIsNone(r['current']['groups'][0]['value']);self.assertEqual(r['current']['groups'][0]['available'],60);self.assertGreater(r['current']['quality'][0]['incompleteReplacements'],0)
    def test_15_theory_measures_and_notes_in_frozen_source(self):
        n=self.t.node('ConsumerAsset',self.t.building,annualEnergyValue=1000,savingsPercent=20)
        code,r=self.req('/api/technical/'+self.cid+'/nodes/'+n['id']+'/measure','PUT',{'implemented':True,'notes':'LED-Tausch nach Abnahme','version':n['version']});self.assertEqual(code,200,r)
        self.measured();d=self.definition();code,r=self.generate(d);self.assertEqual(code,201,r);snap=json.loads(self.raw(r['id'],'snapshot'))
        self.assertEqual(snap['theory'][0]['totals'][0]['value'],1000);self.assertEqual(snap['measures'][0]['savingsPercent'],20);self.assertTrue(snap['measures'][0]['implemented']);self.assertNotIn(self.customer['notes'],snap['customer'].values())
    def test_16_logo_snapshot_and_brand_change_does_not_change_pdf(self):
        import test_workspace as workspace
        helper=workspace.WorkspaceIntegration();helper.admin=self.admin
        before=self.req('/api/branding')[1];code,r=helper.upload('/api/branding/logo?version='+str(before['version']));self.assertEqual(code,200,r)
        try:
            self.measured();d=self.definition();code,r=self.generate(d);self.assertEqual(code,201,r);pdf=self.raw(r['id'],'pdf');snap=json.loads(self.raw(r['id'],'snapshot'));self.assertTrue(snap['logo']);self.assertTrue(__import__('re').search(rb'/Subtype\s*/Image',pdf), 'PDF enthält kein Logo-Bildobjekt')
            current=self.req('/api/branding')[1];self.assertEqual(self.req('/api/branding','PUT',{'motto':'Ein neuer Leitspruch für Folgeversionen','version':current['version']})[0],200);self.assertEqual(self.raw(r['id'],'pdf'),pdf)
        finally:
            current=self.req('/api/branding')[1];self.req('/api/branding/logo?version='+str(current['version']),'DELETE');current=self.req('/api/branding')[1];self.req('/api/branding','PUT',{'motto':before['motto'],'version':current['version']})
    def test_17_collected_readings_cancel_pending_reminder(self):
        p=self.measured();u,client=self.user();self.reminder(u,followUpDays=0);path='/api/reminders/'+self.cid;self.assertEqual(self.req(path+'/plan','POST')[1]['planned'],1)
        self.t.read(p,dt.datetime.now(UTC)-dt.timedelta(minutes=1),500)
        self.assertEqual(self.req(path+'/process','POST')[1]['sent'],0);self.assertEqual(self.req(path+'/')[1]['jobs'][0]['status'],'Cancelled')

    def test_18_historical_quality_review_after_meter_deletion(self):
        p=self.t.meter(at=BEGIN,maxDailyConsumption=1);row=self.t.read(p,END,100,confirmWarning=True,reason='Grenze bewusst überschritten')
        point=self.req('/api/meters/'+p['id'])[1]['point'];self.assertEqual(self.req('/api/meters/'+p['id'],'DELETE',{'version':point['version'],'reason':'Messstelle außer Betrieb genommen'})[0],200)
        self.assertEqual(self.analysis()[1]['current']['quality'][0]['openChecks'],1)
        self.assertEqual(self.req('/api/quality/readings/'+row['id']+'/review','POST',{'version':row['version'],'reason':'Historischen Messwert nachgeprüft'})[0],200)
        self.assertEqual(self.analysis()[1]['current']['quality'][0]['openChecks'],0)

    def test_19_large_valid_register_and_factor_without_intermediate_overflow(self):
        p=self.t.meter(at=BEGIN,factor=1000000,maxDailyConsumption=1)
        row=self.t.read(p,END,1000000000000000,confirmWarning=True,reason='Großer zulässiger Registerstand mit dokumentiertem Faktor')
        code,r=self.analysis();self.assertEqual(code,200,r);self.assertEqual(r['current']['groups'][0]['value'],1000000000000000000000)
        self.assertEqual(r['current']['quality'][0]['openChecks'],1)
        self.assertEqual(self.req('/api/quality/readings/'+row['id']+'/review','POST',{'version':row['version'],'reason':'Faktor und Registerstand geprüft'})[0],200)
        self.assertEqual(self.analysis(areaM2=0.000000001,denominatorSource='Ungültige winzige Fläche')[0],400)
