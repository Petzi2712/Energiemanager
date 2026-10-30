"""CSV/XLSM, Komponentenannahmen, Kopieren und paginierte Historie."""
import datetime as dt
import io
import json
import unittest
import urllib.parse
import uuid
import zipfile
import xml.etree.ElementTree as ET
import test_excel as xl
import test_theory as theory
from test_api import Client,BASE,NEW_PASSWORD

def xlsm(raw):
    out=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as source,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
        for name in source.namelist():
            data=source.read(name)
            if name=='[Content_Types].xml':
                root=ET.fromstring(data)
                for entry in root:
                    if entry.attrib.get('PartName')=='/xl/workbook.xml':entry.attrib['ContentType']='application/vnd.ms-excel.sheet.macroEnabled.main+xml'
                ET.SubElement(root,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',{'PartName':'/xl/vbaProject.bin','ContentType':'application/vnd.ms-office.vbaProject'})
                data=ET.tostring(root)
            if name=='xl/_rels/workbook.xml.rels':
                root=ET.fromstring(data);ET.SubElement(root,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',{'Id':'rIdMacroFixture','Type':'http://schemas.microsoft.com/office/2006/relationships/vbaProject','Target':'vbaProject.bin'});data=ET.tostring(root)
            target.writestr(name,data)
        target.writestr('xl/vbaProject.bin',b'Inert test payload. No VBA runtime is invoked.')
    return out.getvalue()

class ReleaseIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        xl.ExcelIntegration.setUpClass();theory.TheoryIntegration.setUpClass()
        cls.x=xl.ExcelIntegration();cls.t=theory.TheoryIntegration();cls.admin=cls.x.admin;cls.a=cls.x.a
    def test_01_plain_csv_explicit_mapping_and_binding(self):
        p=self.x.meter();q=self.x.meter();at=xl.iso(xl.START+dt.timedelta(days=5))
        raw=('Datum;Zählerstand\r\n'+at+';12,5\r\n').encode('utf-8-sig');files=[('zaehler.csv',raw)]
        self.assertGreater(self.x.upload(files)[1]['errors'],0)
        code,preview=self.x.upload(files,csvPointId=p['id']);self.assertEqual(code,200,preview);self.assertEqual(preview['ready'],1)
        self.assertEqual(self.x.upload(files,preview['token'],csvPointId=q['id'])[0],409)
        self.assertEqual(self.x.upload(files,preview['token'],csvPointId=p['id'])[0],200)
        self.assertEqual(self.x.readings(p)[0]['reading']['value'],12.5)
    def test_02_csv_point_ids_delimiters_encodings_and_quotes(self):
        for delimiter,encoding in [(';','utf-8-sig'),(',','utf-8'),('\t','utf-16'),(';','latin1')]:
            p=self.x.meter();at=xl.iso(xl.START+dt.timedelta(days=5))
            raw=(delimiter.join(['Datum','Zählerstand','ID Messstelle'])+'\r\n'+delimiter.join([at,'"1,25"',p['number']])+'\r\n').encode(encoding)
            files=[('meter.csv',raw)];code,preview=self.x.upload(files);self.assertEqual(code,200,preview);self.assertEqual(preview['errors'],0,preview)
            self.assertEqual(self.x.upload(files,preview['token'])[0],200)
            self.assertEqual(self.x.readings(p)[0]['reading']['value'],1.25)
    def test_03_signed_csv_and_tampering(self):
        p=self.x.meter()
        with self.admin.open.open(BASE+'/api/meters/'+p['id']+'/excel?format=csv',timeout=30) as r:raw=r.read()
        head=raw.decode('utf-8-sig').split('Datum;Zählerstand\r\n')[0]
        filled=(head+'Datum;Zählerstand\r\n'+xl.iso(xl.START+dt.timedelta(days=5))+';55\r\n').encode('utf-8-sig')
        files=[('signed.csv',filled)];code,preview=self.x.upload(files);self.assertEqual(code,200,preview);self.assertEqual(preview['errors'],0,preview)
        self.assertEqual(self.x.upload(files,preview['token'])[0],200)
        changed=filled.replace(p['number'].encode(),b'FREMDE-ID')
        self.assertGreater(self.x.upload([('changed.csv',changed)])[1]['errors'],0)
    def test_04_xlsm_values_without_macro_execution(self):
        p=self.x.meter();data=xlsm(self.x.good(p,75));files=[('macro.xlsm',data)]
        code,preview=self.x.upload(files);self.assertEqual(code,200,preview);self.assertEqual(preview['errors'],0,preview)
        self.assertEqual(self.x.upload(files,preview['token'])[0],200)
        self.assertEqual(self.x.readings(p)[0]['reading']['value'],75)
        self.assertGreater(self.x.upload([('spoof.xlsx',data)])[1]['errors'],0)
    def test_05_mixed_archive_is_atomic(self):
        a=self.x.meter();b=self.x.meter();data=xlsm(self.x.good(a,50))
        csv=('Datum;Zählerstand;ID Messstelle\n'+xl.iso(xl.START+dt.timedelta(days=5))+';60;'+b['number']).encode()
        files=[('mixed.zip',xl.bundle([('a.xlsm',data),('b.csv',csv)]))]
        code,preview=self.x.upload(files);self.assertEqual(code,200,preview);self.assertEqual(preview['ready'],2,preview)
        self.assertEqual(self.x.upload(files,preview['token'])[0],200)
    def test_06_savings_persist_conflicts_and_atomicity(self):
        site=self.t.node();building=self.t.node('Building',site)
        a=self.t.node('ConsumerAsset',building,annualEnergyValue=1000);b=self.t.node('ConsumerAsset',building,annualEnergyValue=2000)
        path='/api/technical/'+self.a['id']+'/savings'
        code,result=self.admin.req(path,'PUT',{'items':[{'id':a['id'],'percent':10,'version':1},{'id':b['id'],'percent':25,'version':1}]});self.assertEqual(code,200,result)
        entries=self.t.balance(building)['entries'];self.assertEqual(sum(e['value']*e['savingsPercent']/100 for e in entries),600)
        self.assertEqual(self.admin.req(path,'PUT',{'items':[{'id':b['id'],'percent':50,'version':2},{'id':a['id'],'percent':99,'version':1}]})[0],409)
        self.assertEqual(next(e['savingsPercent'] for e in self.t.balance(building)['entries'] if e['id']==b['id']),25)
        self.assertEqual(self.admin.req(path,'PUT',{'items':[{'id':a['id'],'percent':101,'version':2}]})[0],400)
        reader=Client();self.assertEqual(reader.login('lesen@weserpark.example',NEW_PASSWORD)[0],200);self.assertEqual(reader.req(path,'PUT',{'items':[{'id':a['id'],'percent':1,'version':2}]})[0],403)
    def test_07_copy_subtree_new_ids_and_independent_values(self):
        site=self.t.node();building=self.t.node('Building',site);group=self.t.node('Area',building,customFields={'Farbe':'Rot'},savingsPercent=12)
        meter=self.x.meter();child=self.t.node('ConsumerAsset',group,annualEnergyValue=250,measuringPointId=meter['id'],savingsPercent=20)
        path='/api/technical/'+self.a['id']+'/nodes/'+group['id']+'/copy'
        code,result=self.admin.req(path,'POST',{'parentId':building['id'],'number':'K-'+uuid.uuid4().hex[:12],'name':'Anlagenkopie','includeChildren':True,'version':1})
        self.assertEqual(code,200,result);self.assertEqual(result['count'],2)
        nodes=[x['node'] for x in self.admin.req('/api/technical/'+self.a['id']+'/tree')[1]['nodes']]
        root=next(n for n in nodes if n['id']==result['id']);copied=next(n for n in nodes if n['parentId']==result['id'])
        self.assertEqual(root['customFields'],{'Farbe':'Rot'});self.assertEqual(copied['savingsPercent'],20);self.assertEqual(copied['annualEnergyValue'],250)
        self.assertNotEqual(copied['id'],child['id']);self.assertNotEqual(copied['number'],child['number']);self.assertIsNone(copied['measuringPointId'])
        self.assertEqual(next(n for n in nodes if n['id']==child['id'])['measuringPointId'],meter['id'])
    def test_08_copy_validation_and_no_partial_writes(self):
        site=self.t.node();building=self.t.node('Building',site);group=self.t.node('Area',building);child=self.t.node('ConsumerAsset',group)
        path='/api/technical/'+self.a['id']+'/nodes/'+group['id']+'/copy'
        before=len(self.admin.req('/api/technical/'+self.a['id']+'/tree')[1]['nodes'])
        self.assertEqual(self.admin.req(path,'POST',{'parentId':building['id'],'number':group['number'],'name':'Doppelte ID','includeChildren':True,'version':1})[0],409)
        self.assertEqual(len(self.admin.req('/api/technical/'+self.a['id']+'/tree')[1]['nodes']),before)
        self.assertEqual(self.admin.req(path,'POST',{'parentId':child['id'],'number':'N-'+uuid.uuid4().hex[:8],'name':'Kreis','includeChildren':True,'version':1})[0],400)
    def test_09_history_pages_and_filter_boundary_consumption(self):
        p=self.x.meter()
        for value in range(1,33):
            code,r=self.admin.req('/api/meters/'+p['id']+'/readings','POST',{'at':xl.iso(xl.START+dt.timedelta(days=1,hours=value)),'value':value});self.assertEqual(code,201,r)
        ids=[]
        for page,count in [(1,15),(2,15),(3,3)]:
            code,r=self.admin.req('/api/meters/'+p['id']+'?page='+str(page));self.assertEqual(code,200,r);self.assertEqual(len(r['readings']),count);self.assertEqual(r['paging']['total'],33)
            ids.extend(x['reading']['id'] for x in r['readings'])
            if page<3:self.assertEqual(r['readings'][-1]['consumption'],1)
        self.assertEqual(len(set(ids)),33)
        query=urllib.parse.urlencode({'from':xl.iso(xl.START+dt.timedelta(days=1,hours=17)),'to':xl.iso(xl.START+dt.timedelta(days=1,hours=21))})
        code,r=self.admin.req('/api/meters/'+p['id']+'?'+query);self.assertEqual(code,200,r);self.assertEqual(r['paging']['total'],5);self.assertEqual(r['readings'][-1]['consumption'],1)

    def test_10_csv_time_unit_and_unquoted_decimal_validation(self):
        p=self.x.meter()
        raw=('Datum;Uhrzeit;Zählerstand;Einheit\n'+(xl.START+dt.timedelta(days=5)).strftime('%d.%m.%Y')+';12:34:56;18,5;kWh\n').encode('utf-8-sig')
        files=[('time.csv',raw)];code,preview=self.x.upload(files,csvPointId=p['id'])
        self.assertEqual(code,200,preview);self.assertEqual(preview['errors'],0,preview)
        self.assertEqual(self.x.upload(files,preview['token'],csvPointId=p['id'])[0],200)
        self.assertEqual(self.x.readings(p)[0]['reading']['value'],18.5)
        self.assertGreater(self.x.upload([('wrong-unit.csv',raw.replace(b'kWh',b'L'))],csvPointId=p['id'])[1]['errors'],0)
        malformed=('Datum,Zählerstand\n'+xl.iso(xl.START+dt.timedelta(days=6))+',12,5\n').encode()
        self.assertGreater(self.x.upload([('columns.csv',malformed)],csvPointId=p['id'])[1]['errors'],0)

if __name__=='__main__':unittest.main(verbosity=2)
