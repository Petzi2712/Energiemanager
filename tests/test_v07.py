"""Gemessene Jahresmengen, Hierarchiesummen und neutraler Analyseexport."""
import datetime as dt
import unittest
import uuid
from zoneinfo import ZoneInfo
from test_api import Client,NEW_PASSWORD
UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC).replace(microsecond=0)-dt.timedelta(hours=1)
YEAR=dt.datetime(NOW.year,1,1,tzinfo=ZoneInfo('Europe/Berlin')).astimezone(UTC)
B=YEAR+(NOW-YEAR)*.2;C=YEAR+(NOW-YEAR)*.4;D=YEAR+(NOW-YEAR)*.6

def iso(t):return t.isoformat().replace('+00:00','Z')
class AnalyticsIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=Client();assert cls.admin.login('admin@sysdatiq.local',NEW_PASSWORD)[0]==200
    def setUp(self):
        self.tag=uuid.uuid4().hex[:12]
        code,self.customer=self.admin.req('/api/customers/','POST',{'number':'PRIVATE-'+self.tag,'name':'Geheimer Betrieb '+self.tag,'address':'Geheimstraße 42','contact':'Vertrauliche Person','email':'privat-'+self.tag+'@example.test'});self.assertEqual(code,201,self.customer)
        self.site=self.node('Site');self.building=self.node('Building',self.site)
    def node(self,kind,parent=None,**values):
        body={'kind':kind,'number':'NODE-'+uuid.uuid4().hex[:12],'name':'Geheime Anlage '+uuid.uuid4().hex[:10],'parentId':parent['id'] if parent else None};body.update(values)
        code,n=self.admin.req('/api/technical/'+self.customer['id']+'/nodes','POST',body);self.assertEqual(code,201,n);return n['node']
    def meter(self,node=None,at=YEAR,initial=0,factor=1,**values):
        body={'number':'SERIAL-'+uuid.uuid4().hex[:12],'name':'Vertraulicher Zähler '+uuid.uuid4().hex[:10],'nodeId':(node or self.building)['id'],'at':iso(at),'initialValue':initial,'device':{'number':'DEVICE-'+uuid.uuid4().hex[:10],'factor':factor},'notes':'FREITEXT-PRIVAT','supplier':'LIEFERANT-PRIVAT'};body.update(values)
        code,p=self.admin.req('/api/meters/?customerId='+self.customer['id'],'POST',body);self.assertEqual(code,201,p);return p
    def read(self,p,at,value,**values):
        body={'at':iso(at),'value':value,'comment':'PERSONENBEZUG-PRIVAT'};body.update(values)
        code,r=self.admin.req('/api/meters/'+p['id']+'/readings','POST',body);self.assertEqual(code,201,r);return r
    def overview(self,node=None,client=None):
        code,r=(client or self.admin).req('/api/technical/'+self.customer['id']+'/meter-overview'+('?nodeId='+node['id'] if node else ''));self.assertEqual(code,200,r);return r
    def prompt(self,**values):
        body={'from':YEAR.astimezone(ZoneInfo('Europe/Berlin')).date().isoformat(),'to':NOW.date().isoformat()};body.update(values)
        return self.admin.req('/api/reports/'+self.customer['id']+'/analysis-prompt','POST',body)
    def test_01_actual_year_factor_and_latest_reading(self):
        p=self.meter(initial=100,factor=2);self.read(p,B,180)
        data=self.overview();row=next(x for x in data['points'] if x['pointId']==p['id'])
        self.assertEqual(row['latestReading']['value'],180);self.assertTrue(row['latestReading']['isCurrentInstallation'])
        self.assertEqual(row['year']['value'],160);self.assertEqual(row['year']['status'],'Gemessen');self.assertEqual(row['year']['coverage'],1)
        self.assertEqual(dt.datetime.fromisoformat(row['year']['from']),YEAR);self.assertEqual(data['totals'][0]['value'],160)
    def test_02_main_child_grandchild_no_double_count_and_units(self):
        main=self.meter();child=self.meter(parentPointId=main['id']);grand=self.meter(parentPointId=child['id'])
        for p,value in [(main,100),(child,30),(grand,10)]:self.read(p,B,value)
        water=self.meter(medium='Water',unit='m³');self.read(water,B,8)
        export=self.meter(direction='Export');self.read(export,B,20)
        groups={(x['medium'],x['unit'],x['direction']):x for x in self.overview()['totals']}
        self.assertEqual(groups[('Electricity','kWh','Import')]['value'],100);self.assertEqual(groups[('Electricity','kWh','Import')]['meters'],1)
        self.assertEqual(groups[('Water','m³','Import')]['value'],8);self.assertEqual(groups[('Electricity','kWh','Export')]['value'],20)
    def test_03_year_boundary_is_not_interpolated_as_actual_and_zero_is_known(self):
        p=self.meter(at=YEAR-dt.timedelta(days=10));self.read(p,B,100)
        row=self.overview()['points'][0];self.assertIsNone(row['year']['value']);self.assertEqual(row['year']['omittedIntervals'],1)
        self.read(p,C,150);row=self.overview()['points'][0];self.assertEqual(row['year']['value'],50);self.assertLess(row['year']['coverage'],1);self.assertEqual(row['year']['status'],'Teilweise erfasst')
        zero=self.meter();self.read(zero,B,0);row=next(x for x in self.overview()['points'] if x['pointId']==zero['id']);self.assertEqual(row['year']['value'],0);self.assertEqual(row['year']['status'],'Gemessen')
    def test_04_replacement_periods_and_factors(self):
        p=self.meter(factor=2);self.read(p,B,20);current=self.admin.req('/api/meters/'+p['id'])[1]['point']
        code,r=self.admin.req('/api/meters/'+p['id']+'/replacement','POST',{'at':iso(C),'oldEndValue':30,'newStartValue':100,'device':{'number':'NEW-'+self.tag,'factor':.5},'reason':'Gerät ausgetauscht','version':current['version']});self.assertEqual(code,200,r)
        self.read(p,D,140);row=self.overview()['points'][0];self.assertEqual(row['year']['value'],80);self.assertEqual(row['latestReading']['value'],140)
    def test_05_historical_hierarchy_changes_count_roots_per_period(self):
        main=self.meter();child=self.meter(parentPointId=main['id']);self.read(main,B,100);self.read(child,B,20)
        version=self.admin.req('/api/meters/'+child['id'])[1]['point']['version']
        code,r=self.admin.req('/api/meters/'+child['id']+'/assignment','POST',{'at':iso(B+dt.timedelta(seconds=1)),'nodeId':self.building['id'],'parentPointId':None,'version':version});self.assertEqual(code,200,r)
        self.read(child,B+dt.timedelta(seconds=1),20);self.read(child,C,30);self.read(main,C,160)
        self.assertEqual(self.overview()['totals'][0]['value'],170)
    def test_06_building_scope_and_linked_meter(self):
        other=self.node('Building',self.site);main=self.meter();child=self.meter(node=other,parentPointId=main['id']);self.read(main,B,100);self.read(child,B,30)
        self.assertEqual(self.overview()['totals'][0]['value'],100);self.assertEqual(self.overview(other)['totals'][0]['value'],30)
        asset=self.node('ConsumerAsset',other,measuringPointId=main['id']);self.assertEqual(self.overview(asset)['totals'][0]['value'],100)
    def test_07_deleted_meters_keep_historical_energy(self):
        p=self.meter();self.read(p,B,50);version=self.admin.req('/api/meters/'+p['id'])[1]['point']['version']
        self.assertEqual(self.admin.req('/api/meters/'+p['id'],'DELETE',{'version':version,'reason':'Zähler demontiert'})[0],200)
        data=self.overview();self.assertEqual(data['points'],[]);self.assertEqual(data['totals'][0]['value'],50)
    def test_08_prompt_neutral_dynamic_and_month_quality(self):
        p=self.meter();self.read(p,B,100);self.read(p,C,150)
        code,r=self.prompt();self.assertEqual(code,200,r);text=r['text'];self.assertIn('Messstelle 001',text);self.assertIn('Monatliche Gesamtreihe',text);self.assertIn('zeitanteilig',text);self.assertIn('Änderung -50',text)
        for private in [self.customer['name'],self.customer['number'],self.customer['id'],self.site['name'],self.site['number'],self.building['name'],p['name'],p['number'],p['id'],'Geheimstraße','Vertrauliche Person','FREITEXT-PRIVAT','LIEFERANT-PRIVAT','PERSONENBEZUG-PRIVAT']:
            self.assertNotIn(private,text)
        self.read(p,D,250);code,updated=self.prompt();self.assertEqual(code,200,updated);self.assertNotEqual(text,updated['text']);self.assertIn('Änderung 100',updated['text'])
    def test_09_prompt_scope_bounds_empty_and_access(self):
        p=self.meter();self.read(p,B,100)
        code,r=self.prompt(medium='Water');self.assertEqual(code,200,r);self.assertEqual(r['pointCount'],0);self.assertIn('keine freigegebenen Messstellen',r['text'])
        self.assertEqual(self.prompt(medium='INVALID')[0],400)
        self.assertEqual(self.prompt(**{'from':'2020-01-01'})[0],400)
        self.assertEqual(self.prompt(**{'from':'9998-01-01','to':'9999-12-31'})[0],400)
        self.assertEqual(self.prompt(**{'from':NOW.date().isoformat(),'to':'2000-01-01'})[0],400)
        outsider=Client();self.assertEqual(outsider.login('lesen@weserpark.example',NEW_PASSWORD)[0],200)
        self.assertEqual(outsider.req('/api/reports/'+self.customer['id']+'/analysis-prompt','POST',{'from':YEAR.date().isoformat(),'to':NOW.date().isoformat()})[0],404)
    def test_10_site_permissions_exclude_forbidden_intervals(self):
        hidden=self.node('Site');hidden_building=self.node('Building',hidden);p=self.meter(node=hidden_building);self.read(p,B,9999)
        version=self.admin.req('/api/meters/'+p['id'])[1]['point']['version'];code,r=self.admin.req('/api/meters/'+p['id']+'/assignment','POST',{'at':iso(C),'nodeId':self.building['id'],'parentPointId':None,'version':version});self.assertEqual(code,200,r)
        self.read(p,C,10000);self.read(p,D,10010)
        email='scope-'+self.tag+'@example.test';code,u=self.admin.req('/api/users/','POST',{'email':email,'name':'Berechtigter Leser','role':'Reader','customerIds':[self.customer['id']]});self.assertEqual(code,201,u)
        self.assertEqual(self.admin.req('/api/users/'+u['id']+'/site-access','PUT',{'customerId':self.customer['id'],'restricted':True,'siteIds':[self.site['id']]})[0],200)
        reader=Client();self.assertEqual(reader.login(email,'Start_Energie')[0],200);self.assertEqual(reader.change()[0],200)
        row=self.overview(client=reader)['points'][0];self.assertEqual(row['year']['value'],10)
        code,r=reader.req('/api/reports/'+self.customer['id']+'/analysis-prompt','POST',{'from':YEAR.astimezone(ZoneInfo('Europe/Berlin')).date().isoformat(),'to':NOW.date().isoformat()});self.assertEqual(code,200,r);self.assertNotIn('9999',r['text']);self.assertNotIn(hidden['id'],r['text'])
        self.assertEqual(reader.req('/api/technical/'+self.customer['id']+'/meter-overview?nodeId='+hidden['id'])[0],404)

    def test_11_small_nonzero_consumption_is_preserved(self):
        p=self.meter(factor=.000001,device={'number':'SMALL-'+self.tag,'factor':.000001,'decimals':6,'resolution':.000001});self.read(p,B,.000001)
        row=self.overview()['points'][0];self.assertGreater(row['year']['value'],0);self.assertAlmostEqual(row['year']['value'],1e-12,places=15)
        code,result=self.prompt();self.assertEqual(code,200,result);self.assertIn('E-12',result['text'])

if __name__=='__main__':unittest.main(verbosity=2)
