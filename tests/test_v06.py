"""Version 0.6: gelöschte Katasterknoten, Gebäudebilanzen, Maßnahmen und Berichtsvorlagen."""
import json
import datetime as dt
import unittest
import uuid
import urllib.request
import urllib.error
from test_api import Client,BASE,NEW_PASSWORD
import test_theory as theory

class WorkspaceV06(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        theory.TheoryIntegration.setUpClass();cls.t=theory.TheoryIntegration();cls.admin=cls.t.admin;cls.a=cls.t.a
        cls.b=next(x for x in cls.admin.req('/api/customers/')[1] if x['number']=='DEMO-002')
        cls.reader=Client();assert cls.reader.login('lesen@weserpark.example',NEW_PASSWORD)[0]==200
    def path(self,n):return '/api/technical/'+self.a['id']+'/nodes/'+n['id']
    def nodes(self):return [x['node'] for x in self.admin.req('/api/technical/'+self.a['id']+'/tree')[1]['nodes']]
    def upload(self,n,content=b'%PDF-1.4\n%%EOF',purpose='Measure',client=None):
        client=client or self.admin;boundary='pdf-'+uuid.uuid4().hex
        body=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="nachweis.pdf"\r\nContent-Type: application/pdf\r\n\r\n').encode()+content+('\r\n--'+boundary+'--\r\n').encode()
        if client.csrf is None:client.csrf=client.req('/api/auth/csrf')[1]['token']
        req=urllib.request.Request(BASE+'/api/documents?nodeId='+n['id']+'&purpose='+purpose,method='POST',headers={'Content-Type':'multipart/form-data; boundary='+boundary,'X-CSRF-TOKEN':client.csrf},data=body)
        try:r=client.open.open(req,timeout=30)
        except urllib.error.HTTPError as e:r=e
        with r:return r.status,json.load(r)
    def test_01_leaf_delete_hidden_audited_and_documents_inaccessible(self):
        site=self.t.node();b=self.t.node('Building',site);n=self.t.node('ConsumerAsset',b,annualEnergyValue=100)
        code,doc=self.upload(n);self.assertEqual(code,201,doc)
        self.assertEqual(self.admin.req(self.path(n),'DELETE',{'version':1,'reason':'Anlage demontiert'})[0],200)
        self.assertNotIn(n['id'],[x['id'] for x in self.nodes()]);self.assertEqual(self.t.balance(b)['entries'],[])
        self.assertEqual(self.admin.req('/api/documents/'+doc['id'])[0],404)
        self.assertEqual(self.admin.req(self.path(n),'PUT',n)[0],404)
        audit=self.admin.req('/api/audit?customerId='+self.a['id']+'&limit=100')[1]
        self.assertTrue(any(x['action']=='Kataster.Gelöscht' and x['target']==n['id'] for x in audit))
    def test_02_parent_conflicts_roles_and_versions(self):
        site=self.t.node();b=self.t.node('Building',site);n=self.t.node('ConsumerAsset',b)
        self.assertEqual(self.admin.req(self.path(b),'DELETE',{'version':1,'reason':'Prüfung Löschung'})[0],409)
        self.assertEqual(self.admin.req(self.path(n),'DELETE',{'version':2,'reason':'Prüfung Löschung'})[0],409)
        self.assertEqual(self.admin.req(self.path(n),'DELETE',{'version':1,'reason':'x'})[0],400)
        self.assertEqual(self.reader.req(self.path(n),'DELETE',{'version':1,'reason':'Fremder Versuch'})[0],403)
        self.assertEqual(self.admin.req(self.path(n),'DELETE',{'version':1,'reason':'Prüfung Löschung'})[0],200)
        self.assertEqual(self.admin.req(self.path(b),'DELETE',{'version':1,'reason':'Leeres Gebäude'})[0],200)
    def test_03_meter_history_blocks_register_delete(self):
        site=self.t.node();b=self.t.node('Building',site);tag=uuid.uuid4().hex
        body={'number':tag,'name':'Zählerhistorie','nodeId':b['id'],'at':(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=2)).isoformat(),'initialValue':0,'device':{'number':'D-'+tag}}
        code,p=self.admin.req('/api/meters/?customerId='+self.a['id'],'POST',body);self.assertEqual(code,201,p)
        self.assertEqual(self.admin.req(self.path(b),'DELETE',{'version':1,'reason':'Historie schützen'})[0],409)
        self.assertEqual(self.admin.req('/api/meters/'+p['id'])[0],200)
    def test_04_overview_separate_buildings_media_and_scopes(self):
        site=self.t.node();a=self.t.node('Building',site,name='Gleicher Name');b=self.t.node('Building',site,name='Gleicher Name')
        x=self.t.node('ConsumerAsset',a,annualEnergyValue=1000);self.t.node('ConsumerAsset',b,annualEnergyValue=2,annualEnergyUnit='MWh');self.t.node('ConsumerAsset',b,annualEnergyValue=10,annualEnergyMedium='Water',annualEnergyUnit='m³')
        code,r=self.admin.req('/api/technical/'+self.a['id']+'/balance-overview');self.assertEqual(code,200,r)
        byid={x['id']:x for x in r['buildings']};self.assertEqual(byid[a['id']]['totals'][0]['value'],1000);self.assertEqual(len(byid[b['id']]['totals']),2)
        self.assertIn(x['id'],[e['id'] for e in r['total']['entries']]);self.assertEqual(self.reader.req('/api/technical/'+self.a['id']+'/balance-overview')[0],404)
    def test_05_measure_persistence_conflict_pdf_separation_and_copy(self):
        site=self.t.node();b=self.t.node('Building',site);n=self.t.node('ConsumerAsset',b,annualEnergyValue=500,savingsPercent=20)
        body={'implemented':True,'notes':'LED-Tausch abgeschlossen.\nNachprüfung dokumentiert.','version':1}
        self.assertEqual(self.admin.req(self.path(n)+'/measure','PUT',body)[0],200)
        self.assertEqual(self.admin.req(self.path(n)+'/measure','PUT',body)[0],409)
        e=next(x for x in self.t.balance(b)['entries'] if x['id']==n['id']);self.assertTrue(e['measureImplemented']);self.assertEqual(e['measureNotes'],body['notes'])
        code,doc=self.upload(n);self.assertEqual(code,201,doc)
        self.assertEqual(len(self.admin.req('/api/documents?nodeId='+n['id']+'&purpose=Measure')[1]),1)
        self.assertEqual(self.admin.req('/api/documents?nodeId='+n['id'])[1],[])
        self.assertEqual(self.upload(n,b'not a pdf')[0],400)
        self.assertEqual(self.reader.req('/api/documents/'+doc['id'])[0],404)
        code,copy=self.admin.req(self.path(n)+'/copy','POST',{'parentId':b['id'],'number':uuid.uuid4().hex,'name':'Neue Anlage','includeChildren':False,'version':2});self.assertEqual(code,200,copy)
        c=next(x for x in self.nodes() if x['id']==copy['id']);self.assertFalse(c['measureImplemented']);self.assertEqual(c['measureNotes'],'');self.assertEqual(c['savingsPercent'],20)
        self.assertEqual(self.admin.req('/api/documents/'+doc['id'],'DELETE')[0],200)
    def test_06_measure_rights_and_validation(self):
        site=self.t.node();b=self.t.node('Building',site);n=self.t.node('ConsumerAsset',b)
        body={'implemented':True,'notes':'Umgesetzt','version':1}
        self.assertEqual(self.reader.req(self.path(n)+'/measure','PUT',body)[0],403)
        self.assertEqual(self.admin.req(self.path(n)+'/measure','PUT',{**body,'notes':'x'*10001})[0],400)
        self.assertEqual(self.upload(n,client=self.reader)[0],403)
    def report(self,**values):
        body={'name':'Analyse '+uuid.uuid4().hex[:8],'from':'2026-01-01','to':'2026-10-30','medium':'Electricity'};body.update(values)
        return self.admin.req('/api/reports/'+self.a['id']+'/','POST',body)
    def test_07_report_crud_filters_conflicts_and_delete(self):
        site=self.t.node();b=self.t.node('Building',site);n=self.t.node('ConsumerAsset',b)
        code,r=self.report(siteId=site['id'],buildingId=b['id'],nodeId=n['id'],notes='Eigene Auswertung');self.assertEqual(code,201,r)
        path='/api/reports/'+self.a['id']+'/'+r['id'];r['name']='Geänderter Bericht'
        self.assertEqual(self.admin.req(path,'PUT',r)[0],200);self.assertEqual(self.admin.req(path,'PUT',r)[0],409)
        self.assertEqual(self.admin.req(self.path(n),'DELETE',{'version':1,'reason':'Vorlage verweist'})[0],409)
        self.assertEqual(self.admin.req(path,'DELETE',{'version':2,'reason':'Vorlage entfernt'})[0],200)
        self.assertNotIn(r['id'],[x['id'] for x in self.admin.req('/api/reports/'+self.a['id']+'/')[1]])
    def test_08_report_hierarchy_dates_media_and_rights(self):
        a=self.t.node();b=self.t.node('Building',a);other=self.t.node()
        for fields in [{'siteId':other['id'],'buildingId':b['id']},{'medium':'Unbekannt'},{'from':'2026-12-01','to':'2026-01-01'},{'pdf':False,'excel':False}]:self.assertEqual(self.report(**fields)[0],400,fields)
        self.assertEqual(self.reader.req('/api/reports/'+self.a['id']+'/')[0],404)
        self.assertEqual(self.reader.req('/api/reports/'+self.a['id']+'/','POST',{'name':'Versuch'})[0],403)
    def test_09_site_scoped_overview_and_report_list(self):
        site=self.t.node();b=self.t.node('Building',site);self.t.node('ConsumerAsset',b,annualEnergyValue=123)
        other=self.t.node();hidden=self.t.node('Building',other);self.t.node('ConsumerAsset',hidden,annualEnergyValue=999)
        _,global_report=self.report();_,local_report=self.report(siteId=site['id'])
        email='scope-'+uuid.uuid4().hex[:10]+'@example.test'
        code,u=self.admin.req('/api/users/','POST',{'email':email,'name':'Standortleser','role':'Reader','customerIds':[self.a['id']]});self.assertEqual(code,201,u)
        self.assertEqual(self.admin.req('/api/users/'+u['id']+'/site-access','PUT',{'customerId':self.a['id'],'restricted':True,'siteIds':[site['id']]})[0],200)
        reader=Client();self.assertEqual(reader.login(email,'Start_Energie')[0],200);self.assertEqual(reader.change()[0],200)
        _,overview=reader.req('/api/technical/'+self.a['id']+'/balance-overview');self.assertEqual([x['id'] for x in overview['buildings']],[b['id']]);self.assertEqual(overview['total']['totals'][0]['value'],123)
        ids=[x['id'] for x in reader.req('/api/reports/'+self.a['id']+'/')[1]];self.assertIn(local_report['id'],ids);self.assertNotIn(global_report['id'],ids)

if __name__=='__main__':unittest.main(verbosity=2)
