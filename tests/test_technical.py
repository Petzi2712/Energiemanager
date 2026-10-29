"""Fachliche Integrationstests; nach test_api auf derselben frischen Testinstanz."""
import datetime as dt
import json
import struct
import unittest
import urllib.error
import urllib.request
import urllib.parse
import uuid
import zlib
from test_api import Client, BASE, NEW_PASSWORD

def iso(value): return value.isoformat().replace('+00:00','Z')
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
START = NOW - dt.timedelta(days=10)

class TechnicalIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=Client()
        code,user=cls.admin.login('admin@sysdatiq.local',NEW_PASSWORD)
        assert code==200,user
        rows=cls.admin.req('/api/customers/')[1]
        cls.a=next(c for c in rows if c['number']=='DEMO-001')
        cls.b=next(c for c in rows if c['number']=='DEMO-002')
        cls.tree=cls.admin.req('/api/technical/'+cls.a['id']+'/tree')[1]
        assert isinstance(cls.tree,dict) and 'nodes' in cls.tree,cls.tree
        cls.site=next(x['node'] for x in cls.tree['nodes'] if x['node']['number']=='HB-01')
        cls.site2=next(x['node'] for x in cls.tree['nodes'] if x['node']['number']=='HB-02')
        cls.main=next(x for x in cls.tree['points'] if x['point']['number']=='E-HAUPT')

    def meter(self,initial=100,**kwargs):
        tag=uuid.uuid4().hex[:10]
        data={'number':'TEST-'+tag,'name':'Prüfzähler '+tag,'nodeId':self.site['id'],'parentPointId':None,'at':iso(START),'device':{'number':'GERAET-'+tag},'initialValue':initial}
        data.update(kwargs)
        code,p=self.admin.req('/api/meters/?customerId='+self.a['id'],'POST',data)
        self.assertEqual(code,201,p)
        return p

    def reading(self,p,value,day=10,**kwargs):
        data={'at':iso(START+dt.timedelta(days=day)),'value':value}
        data.update(kwargs)
        return self.admin.req('/api/meters/'+p['id']+'/readings','POST',data)

    def detail(self,p):
        code,r=self.admin.req('/api/meters/'+p['id']);self.assertEqual(code,200,r);return r

    def test_01_demo_and_asset_calculation(self):
        self.assertEqual(len([x for x in self.tree['nodes'] if x['node']['kind']=='Site']),2)
        self.assertEqual(len(self.tree['points']),8)
        asset=next(x for x in self.tree['nodes'] if x['node']['number']=='LED-01')
        self.assertEqual(asset['estimatedPowerKw'],3.6)
        self.assertEqual(asset['estimatedAnnualKwh'],7200)

    def test_02_site_building_edit_conflict(self):
        data={'kind':'Site','name':'Neuer Standort','number':'SITE-'+uuid.uuid4().hex[:8],'customFields':{'Nutzung':'Test'},'usableArea':250}
        code,r=self.admin.req('/api/technical/'+self.a['id']+'/nodes','POST',data)
        self.assertEqual(code,201,r)
        node=r['node'];original=dict(node);node['name']='Geänderter Standort'
        path='/api/technical/'+self.a['id']+'/nodes/'+node['id']
        self.assertEqual(self.admin.req(path,'PUT',node)[0],200)
        self.assertEqual(self.admin.req(path,'PUT',original)[0],409)

    def test_03_foreign_parent_rejected(self):
        code,r=self.admin.req('/api/technical/'+self.b['id']+'/nodes','POST',{'kind':'Building','name':'Fremder Elternknoten','number':uuid.uuid4().hex,'parentId':self.site['id']})
        self.assertEqual(code,400,r)

    def test_04_valid_consumption_and_duplicate(self):
        p=self.meter();self.assertEqual(self.reading(p,150)[0],201)
        detail=self.detail(p)
        self.assertEqual(detail['readings'][0]['consumption'],50)
        self.assertEqual(self.reading(p,150)[0],409)

    def test_05_negative_and_precision_invalid(self):
        p=self.meter();self.assertEqual(self.reading(p,99)[0],400)
        self.assertEqual(self.reading(p,110.1)[0],400)

    def test_06_warning_requires_reason(self):
        p=self.meter(maxDailyConsumption=5)
        self.assertEqual(self.reading(p,1000)[0],422)
        code,r=self.reading(p,1000,confirmWarning=True,reason='Nach Prüfung korrekt')
        self.assertEqual(code,201,r);self.assertEqual(r['status'],'Auffällig')

    def test_07_rollover_explicit(self):
        p=self.meter(initial=990,device={'number':uuid.uuid4().hex,'registerLimit':1000})
        self.assertEqual(self.reading(p,5)[0],400)
        code,r=self.reading(p,5,isRollover=True,confirmWarning=True,reason='Überlauf am Zähler geprüft')
        self.assertEqual(code,201,r);self.assertEqual(self.detail(p)['readings'][0]['consumption'],15)

    def test_08_backdated_reading_checks_following(self):
        p=self.meter();self.assertEqual(self.reading(p,120,2)[0],201)
        self.assertEqual(self.reading(p,130,1)[0],400)

    def test_09_reading_correction_history(self):
        p=self.meter();code,r=self.reading(p,200)
        self.assertEqual(code,201,r)
        path='/api/meters/'+p['id']+'/readings/'+r['id']
        code,changed=self.admin.req(path,'PUT',{'at':r['at'],'value':160,'reason':'Tippfehler korrigiert','version':1})
        self.assertEqual(code,200,changed)
        detail=self.detail(p);self.assertEqual(detail['readings'][0]['consumption'],60)
        self.assertEqual(json.loads(detail['revisions'][0]['before'])['Value'],200)
        self.assertEqual(json.loads(detail['revisions'][0]['after'])['Value'],160)

    def test_10_replacement_separates_devices_and_factors(self):
        p=self.meter();at=iso(START+dt.timedelta(days=5))
        code,r=self.admin.req('/api/meters/'+p['id']+'/replacement','POST',{'at':at,'oldEndValue':150,'newStartValue':10,'device':{'number':uuid.uuid4().hex,'factor':2},'reason':'Defektes Gerät ausgetauscht','version':1})
        self.assertEqual(code,200,r)
        self.assertEqual(self.reading(p,20)[0],201)
        detail=self.detail(p);self.assertEqual(len(detail['installations']),2)
        self.assertEqual(detail['readings'][0]['consumption'],20)
        code,b=self.admin.req('/api/meters/'+p['id']+'/balance?from='+iso(START)+'&to='+iso(NOW))
        self.assertEqual(code,200,b);self.assertEqual(b['consumption'],70)

    def test_11_incomplete_replacement(self):
        p=self.meter();data={'at':iso(START+dt.timedelta(days=5)),'oldEndValue':None,'newStartValue':0,'device':{'number':uuid.uuid4().hex},'reason':'Ausbauwert nicht lesbar','version':1}
        self.assertEqual(self.admin.req('/api/meters/'+p['id']+'/replacement','POST',data)[0],422)
        data['confirmIncomplete']=True
        self.assertEqual(self.admin.req('/api/meters/'+p['id']+'/replacement','POST',data)[0],200)
        self.assertEqual(self.reading(p,20)[0],201)
        code,b=self.admin.req('/api/meters/'+p['id']+'/balance?from='+iso(START)+'&to='+iso(NOW))
        self.assertEqual(code,200,b);self.assertEqual(b['status'],'Unvollständig');self.assertIsNone(b['consumption'])

    def test_12_main_sub_balance_no_double_count(self):
        detail=self.detail(self.main['point']);times=sorted(r['reading']['at'] for r in detail['readings'])
        code,b=self.admin.req('/api/meters/'+self.main['point']['id']+'/balance?from='+urllib.parse.quote(times[0])+'&to='+urllib.parse.quote(times[1]))
        self.assertEqual(code,200,b);self.assertEqual(b['consumption'],10000);self.assertEqual(b['submeterTotal'],9000);self.assertEqual(b['unassignedConsumption'],1000)

    def test_13_mismatched_medium_rejected(self):
        data={'number':uuid.uuid4().hex,'name':'Ungültiger Unterzähler','nodeId':self.site['id'],'parentPointId':self.main['point']['id'],'at':iso(START),'device':{'number':uuid.uuid4().hex},'medium':'Water','unit':'m³'}
        code,r=self.admin.req('/api/meters/?customerId='+self.a['id'],'POST',data)
        self.assertEqual(code,400,r)

    def test_14_cycle_rejected(self):
        parent=self.meter();child=self.meter(parentPointId=parent['id'])
        code,r=self.admin.req('/api/meters/'+parent['id']+'/assignment','POST',{'nodeId':self.site['id'],'parentPointId':child['id'],'at':iso(NOW),'version':1})
        self.assertEqual(code,400,r)

    def test_15_assignment_history(self):
        p=self.meter()
        code,r=self.admin.req('/api/meters/'+p['id']+'/assignment','POST',{'nodeId':self.site2['id'],'parentPointId':None,'at':iso(NOW),'version':1})
        self.assertEqual(code,200,r);self.assertEqual(len(self.detail(p)['assignments']),2)

    def test_16_site_permissions_and_reader(self):
        email='scope-'+uuid.uuid4().hex[:8]+'@example.test'
        code,u=self.admin.req('/api/users/','POST',{'email':email,'name':'Standorttester','role':'Reader','customerIds':[self.a['id']]})
        self.assertEqual(code,201,u)
        client=Client();self.assertEqual(client.login(email,'Start_Energie')[0],200);self.assertEqual(client.change()[0],200)
        path='/api/users/'+u['id']+'/site-access'
        self.assertEqual(self.admin.req(path,'PUT',{'customerId':self.a['id'],'restricted':True,'siteIds':[self.site2['id']]})[0],200)
        code,tree=client.req('/api/technical/'+self.a['id']+'/tree');self.assertEqual(code,200,tree)
        self.assertEqual([x['node']['id'] for x in tree['nodes'] if x['node']['kind']=='Site'],[self.site2['id']])
        self.assertEqual(client.req('/api/meters/'+self.main['point']['id'])[0],404)
        self.assertEqual(client.req('/api/meters/'+self.main['point']['id']+'/readings','POST',{'at':iso(NOW),'value':130000})[0],403)

    def test_17_active_structure_cannot_be_deactivated(self):
        node=dict(self.site);node['isActive']=False
        self.assertEqual(self.admin.req('/api/technical/'+self.a['id']+'/nodes/'+node['id'],'PUT',node)[0],400)

    def test_18_photo_real_storage_metadata_and_tenant_access(self):
        p=self.meter();r=self.detail(p)['readings'][0]['reading']
        def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,2,8,2,0,0,0))+chunk(b'tEXt',b'Comment\x00private-GPS-metadata')+chunk(b'IDAT',zlib.compress((b'\x00'+b'\xff\x00\x00'*2)*2))+chunk(b'IEND',b'')
        boundary='test-boundary-'+uuid.uuid4().hex
        body=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="zaehler.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+('\r\n--'+boundary+'--\r\n').encode()
        if self.admin.csrf is None:self.admin.csrf=self.admin.req('/api/auth/csrf')[1]['token']
        req=urllib.request.Request(BASE+'/api/documents?readingId='+r['id'],method='POST',headers={'X-CSRF-TOKEN':self.admin.csrf,'Content-Type':'multipart/form-data; boundary='+boundary},data=body)
        with self.admin.open.open(req,timeout=30) as response:doc=json.load(response)
        with self.admin.open.open(BASE+'/api/documents/'+doc['id'],timeout=15) as response:
            image=response.read();self.assertEqual(response.headers['Content-Type'],'image/jpeg')
        self.assertTrue(image.startswith(b'\xff\xd8'));self.assertNotIn(b'private-GPS-metadata',image)
        outsider=Client();self.assertEqual(outsider.login('lesen@weserpark.example',NEW_PASSWORD)[0],200)
        self.assertEqual(outsider.req('/api/documents/'+doc['id'])[0],404)

    def test_19_restricted_customeradmin_cannot_delegate_more_access(self):
        email='limited-admin-'+uuid.uuid4().hex[:8]+'@example.test'
        code,u=self.admin.req('/api/users/','POST',{'email':email,'name':'Eingeschränkte Administration','role':'CustomerAdmin','customerIds':[self.a['id']]})
        self.assertEqual(code,201,u)
        self.assertEqual(self.admin.req('/api/users/'+u['id']+'/site-access','PUT',{'customerId':self.a['id'],'restricted':True,'siteIds':[self.site2['id']]})[0],200)
        manager=Client();self.assertEqual(manager.login(email,'Start_Energie')[0],200);self.assertEqual(manager.change()[0],200)
        code,child=manager.req('/api/users/','POST',{'email':'delegated-'+uuid.uuid4().hex[:8]+'@example.test','name':'Delegierter Leser','role':'Reader','customerIds':[self.a['id']]})
        self.assertEqual(code,201,child)
        code,scope=self.admin.req('/api/users/'+child['id']+'/site-access?customerId='+self.a['id'])
        self.assertEqual(code,200,scope);self.assertTrue(scope['restricted']);self.assertEqual(scope['siteIds'],[self.site2['id']])
        existing=next(u for u in self.admin.req('/api/users/')[1] if u['email']=='ablesung@nordwerk.example')
        self.assertEqual(manager.req('/api/users/'+existing['id'],'PUT',existing)[0],403)

    def test_20_dashboard_real_counts(self):
        code,d=self.admin.req('/api/dashboard');self.assertEqual(code,200,d)
        self.assertGreaterEqual(d['sites'],3);self.assertGreaterEqual(d['measuringPoints'],10)
        self.assertGreaterEqual(d['overdueReadings'],1)
        self.assertTrue(d['recentReadings'])

if __name__=='__main__':unittest.main(verbosity=2)
