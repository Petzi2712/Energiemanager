import unittest
import uuid
from test_api import Client,NEW_PASSWORD

class TheoryIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=Client();assert cls.admin.login('admin@sysdatiq.local',NEW_PASSWORD)[0]==200
        cls.a=next(c for c in cls.admin.req('/api/customers/')[1] if c['number']=='DEMO-001')
    def node(self,kind='Site',parent=None,**kw):
        body=dict(kind=kind,parentId=parent['id'] if parent else None,number=uuid.uuid4().hex[:14],name='Theorietest '+uuid.uuid4().hex[:6]);body.update(kw)
        code,r=self.admin.req('/api/technical/'+self.a['id']+'/nodes','POST',body);self.assertEqual(code,201,r);return r['node']
    def balance(self,node):
        code,r=self.admin.req('/api/technical/'+self.a['id']+'/balance?nodeId='+node['id']);self.assertEqual(code,200,r);return r
    def test_01_building_and_site_sum_and_generation_separate(self):
        site=self.node();a=self.node('Building',site);b=self.node('Building',site)
        self.node('ConsumerAsset',a,quantity=24,ratedPowerW=150,annualHours=2000,assetType='Beleuchtung')
        self.node('ConsumerAsset',b,annualEnergyValue=2,annualEnergyUnit='MWh',assetType='Maschinen')
        self.node('ConsumerAsset',a,annualEnergyValue=10000,assetRole='Generation',assetType='PV')
        self.assertEqual(next(t['value'] for t in self.balance(a)['totals'] if t['role']=='Consumption'),7200)
        totals=self.balance(site)['totals'];self.assertEqual(next(t['value'] for t in totals if t['role']=='Consumption'),9200);self.assertEqual(next(t['value'] for t in totals if t['role']=='Generation'),10000)
    def test_02_explicit_parent_does_not_double_count_children(self):
        site=self.node();b=self.node('Building',site);group=self.node('Area',b,annualEnergyValue=1000)
        self.node('ConsumerAsset',group,annualEnergyValue=300)
        self.node('ConsumerAsset',group,annualEnergyValue=400,annualEnergyMedium='Heat')
        r=self.balance(b);self.assertEqual(r['covered'],1);self.assertEqual(len(r['entries']),2);self.assertEqual(sum(e['value'] for e in r['entries']),1400)
    def test_03_volume_and_energy_are_not_added(self):
        site=self.node();b=self.node('Building',site)
        self.node('ConsumerAsset',b,annualEnergyValue=100,annualEnergyUnit='m³',annualEnergyMedium='Water')
        self.node('ConsumerAsset',b,annualEnergyValue=200)
        r=self.balance(b);self.assertEqual(len(r['totals']),2);self.assertEqual({t['unit'] for t in r['totals']},{'m³','kWh'})
    def test_04_inactive_and_missing_values(self):
        site=self.node();b=self.node('Building',site)
        self.node('ConsumerAsset',b,annualEnergyValue=500,isActive=False)
        self.node('ConsumerAsset',b)
        self.node('ConsumerAsset',b,annualEnergyValue=0)
        r=self.balance(b);self.assertEqual(r['totals'][0]['value'],0);self.assertEqual(len(r['missing']),1)
    def test_05_scope_and_negative_annual_value(self):
        site=self.node();b=self.node('Building',site)
        reader=Client();self.assertEqual(reader.login('lesen@weserpark.example',NEW_PASSWORD)[0],200)
        self.assertEqual(reader.req('/api/technical/'+self.a['id']+'/balance?nodeId='+b['id'])[0],404)
        self.assertEqual(self.admin.req('/api/technical/'+self.a['id']+'/nodes','POST',dict(kind='ConsumerAsset',parentId=b['id'],number=uuid.uuid4().hex,name='Fehler',annualEnergyValue=-1))[0],400)

if __name__=='__main__':unittest.main(verbosity=2)
