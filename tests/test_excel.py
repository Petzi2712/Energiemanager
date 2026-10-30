"""Reale XLSX-/ZIP-Rundläufe; nur Standardbibliothek für die Compose-Testumgebung."""
import datetime as dt
import io
import json
import time
import unittest
import urllib.error
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from test_api import Client, BASE, NEW_PASSWORD

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
TAG = '{' + NS['s'] + '}'
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
START = NOW - dt.timedelta(days=20)
def iso(t): return t.isoformat().replace('+00:00', 'Z')
def filled(original, cells):
    source = zipfile.ZipFile(io.BytesIO(original)); out = io.BytesIO()
    xml = ET.fromstring(source.read('xl/worksheets/sheet1.xml'))
    data = xml.find('s:sheetData', NS)
    for address, value in cells.items():
        rownum = ''.join(filter(str.isdigit, address))
        row = next((r for r in data if r.attrib['r'] == rownum), None)
        if row is None: row = ET.SubElement(data, TAG+'row', {'r': rownum})
        cell = next((c for c in row if c.attrib['r'] == address), None)
        if cell is None: cell = ET.SubElement(row, TAG+'c', {'r': address})
        for child in list(cell): cell.remove(child)
        if isinstance(value, (float, int)):
            cell.attrib['t'] = 'n'; ET.SubElement(cell, TAG+'v').text = str(value)
        elif isinstance(value, str) and value.startswith('='):
            cell.attrib['t'] = 'n'; ET.SubElement(cell, TAG+'f').text = value[1:]; ET.SubElement(cell, TAG+'v').text = '0'
        else:
            cell.attrib['t'] = 'inlineStr'; ET.SubElement(ET.SubElement(cell, TAG+'is'), TAG+'t').text = str(value)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as target:
        for name in source.namelist(): target.writestr(name, ET.tostring(xml) if name == 'xl/worksheets/sheet1.xml' else source.read(name))
    return out.getvalue()
def bundle(files):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in files: z.writestr(name, data)
    return out.getvalue()

class ExcelIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = Client(); assert cls.admin.login('admin@sysdatiq.local', NEW_PASSWORD)[0] == 200
        cls.a = next(c for c in cls.admin.req('/api/customers/')[1] if c['number'] == 'DEMO-001')
        cls.site = next(n['node'] for n in cls.admin.req('/api/technical/'+cls.a['id']+'/tree')[1]['nodes'] if n['node']['number'] == 'HB-01')
        cls.reader = Client(); assert cls.reader.login('lesen@weserpark.example', NEW_PASSWORD)[0] == 200
    def meter(self, **kw):
        tag = uuid.uuid4().hex
        body = dict(number='XL-'+tag[:10], name='Excelzähler '+tag[:8], nodeId=self.site['id'], at=iso(START), initialValue=0, device={'number':tag, 'decimals':3, 'resolution':.001})
        body.update(kw); code,p = self.admin.req('/api/meters/?customerId='+self.a['id'], 'POST', body)
        self.assertEqual(code,201,p); return p
    def template(self,p):
        with self.admin.open.open(BASE+'/api/meters/'+p['id']+'/excel', timeout=30) as r:
            self.assertIn('spreadsheetml',r.headers['Content-Type']); return r.read()
    def upload(self, files, preview=None, confirm=False, reason='', client=None, csvPointId=None):
        client = client or self.admin
        if client.csrf is None: client.csrf=client.req('/api/auth/csrf')[1]['token']
        boundary='upload-'+uuid.uuid4().hex; parts=[]
        for name,data in files:
            parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="files"; filename="'+name+'"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+data+b'\r\n')
        for name,value in [('previewToken',preview or ''),('confirmWarnings',str(confirm).lower()),('reason',reason),('csvPointId',csvPointId or '')]:
            parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"\r\n\r\n'+value+'\r\n').encode())
        body=b''.join(parts)+('--'+boundary+'--\r\n').encode()
        path='/api/meter-excel/'+('import' if preview is not None else 'preview')+'?customerId='+self.a['id']
        req=urllib.request.Request(BASE+path,method='POST',headers={'Content-Type':'multipart/form-data; boundary='+boundary,'X-CSRF-TOKEN':client.csrf},data=body)
        try:r=client.open.open(req,timeout=60)
        except urllib.error.HTTPError as e:r=e
        with r:return r.status,json.load(r)
    def readings(self,p):return self.admin.req('/api/meters/'+p['id'])[1]['readings']
    def good(self,p,value=100,days=10):return filled(self.template(p),{'A15':iso(START+dt.timedelta(days=days)),'B15':value})

    def test_01_protection_and_signed_single_template(self):
        p=self.meter(); raw=self.template(p)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml')); self.assertIsNotNone(sheet.find('s:sheetProtection',NS))
            workbook=ET.fromstring(z.read('xl/workbook.xml')); self.assertEqual(workbook.find('s:sheets',NS)[1].attrib['state'],'veryHidden')
            self.assertIn(workbook.find('s:workbookProtection',NS).attrib.get('lockStructure'),['1','true'])
            styles=ET.fromstring(z.read('xl/styles.xml')).find('s:cellXfs',NS)
            cells={c.attrib['r']:c for c in sheet.findall('.//s:c',NS)}
            self.assertIn(styles[int(cells['A15'].attrib['s'])].find('s:protection',NS).attrib['locked'],['0','false'])
            self.assertIn(styles[int(cells['B15'].attrib['s'])].find('s:protection',NS).attrib['locked'],['0','false'])
        self.assertEqual(self.reader.req('/api/meters/'+p['id']+'/excel')[0],404)

    def test_02_multiple_unsorted_readings_and_idempotent_retry(self):
        p=self.meter(); file=filled(self.template(p),{'A15':iso(START+dt.timedelta(days=10)),'B15':100,'A16':iso(START+dt.timedelta(days=5)),'B16':50})
        code,preview=self.upload([('meter.xlsx',file)]);self.assertEqual(code,200,preview);self.assertEqual(preview['ready'],2);self.assertEqual(preview['errors'],0)
        self.assertEqual(len(self.readings(p)),1)
        code,result=self.upload([('meter.xlsx',file)],preview['token']);self.assertEqual(code,200,result);self.assertEqual(result['imported'],2)
        self.assertEqual([r['reading']['value'] for r in self.readings(p)],[100,50,0])
        code,again=self.upload([('meter.xlsx',file)]);self.assertEqual(again['ready'],0);self.assertEqual(again['skipped'],2)

    def test_03_bulk_zip_download_and_upload(self):
        a=self.meter();b=self.meter()
        body=json.dumps(dict(customerId=self.a['id'],pointIds=[a['id'],b['id']])).encode()
        csrf=self.admin.req('/api/auth/csrf')[1]['token']
        req=urllib.request.Request(BASE+'/api/meter-excel/export',method='POST',headers={'Content-Type':'application/json','X-CSRF-TOKEN':csrf},data=body)
        with self.admin.open.open(req,timeout=60) as r:
            with zipfile.ZipFile(io.BytesIO(r.read())) as z:self.assertEqual(len(z.namelist()),2)
        files=[('a.xlsx',self.good(a,80)),('b.xlsx',self.good(b,90))]
        packed=[('filled.zip',bundle(files))]
        code,preview=self.upload(packed);self.assertEqual(code,200,preview);self.assertEqual(preview['ready'],2)
        code,result=self.upload(packed,preview['token']);self.assertEqual(code,200,result);self.assertEqual(result['imported'],2)

    def test_04_locked_field_tampering_rejected(self):
        p=self.meter();raw=filled(self.good(p),{'B5':'Anderer Zähler'})
        code,preview=self.upload([('tampered.xlsx',raw)]);self.assertEqual(code,200,preview);self.assertGreater(preview['errors'],0)
        self.assertEqual(self.upload([('tampered.xlsx',raw)],preview['token'])[0],422);self.assertEqual(len(self.readings(p)),1)

    def test_05_formulas_and_extra_cells_rejected(self):
        p=self.meter();raw=self.good(p)
        for changes in [{'B15':'=100+1'},{'C15':'Zusatz'},{'A515':iso(NOW),'B515':200}]:
            code,preview=self.upload([('bad.xlsx',filled(raw,changes))]);self.assertEqual(code,200,preview);self.assertGreater(preview['errors'],0)

    def test_06_invalid_one_file_rolls_back_whole_batch(self):
        a=self.meter();b=self.meter()
        files=[('a.xlsx',self.good(a)),('b.xlsx',filled(self.template(b),{'A15':'kein Datum','B15':50}))]
        code,preview=self.upload(files);self.assertEqual(code,200,preview);self.assertGreater(preview['errors'],0)
        self.assertEqual(self.upload(files,preview['token'])[0],422);self.assertEqual(len(self.readings(a)),1);self.assertEqual(len(self.readings(b)),1)

    def test_07_changed_file_or_changed_point_requires_new_preview(self):
        p=self.meter();file=self.good(p);code,preview=self.upload([('a.xlsx',file)]);self.assertEqual(code,200)
        self.assertEqual(self.upload([('a.xlsx',filled(file,{'B15':101}))],preview['token'])[0],409)
        self.assertEqual(self.admin.req('/api/meters/'+p['id']+'/readings','POST',dict(at=iso(START+dt.timedelta(days=1)),value=10))[0],201)
        self.assertEqual(self.upload([('a.xlsx',file)],preview['token'])[0],409)

    def test_08_explicit_limits_require_confirmation(self):
        p=self.meter(maxDailyConsumption=1); files=[('a.xlsx',self.good(p,100))]
        code,preview=self.upload(files);self.assertEqual(code,200,preview);self.assertEqual(preview['warnings'],1)
        self.assertEqual(self.upload(files,preview['token'])[0],422)
        code,result=self.upload(files,preview['token'],True,'Verbrauch nach Prüfung bestätigt');self.assertEqual(code,200,result)
        self.assertEqual(self.readings(p)[0]['reading']['status'],'Auffällig')

    def test_09_no_implicit_median_warning(self):
        p=self.meter()
        for day in range(1,5):self.assertEqual(self.admin.req('/api/meters/'+p['id']+'/readings','POST',dict(at=iso(START+dt.timedelta(days=day)),value=day))[0],201)
        files=[('a.xlsx',self.good(p,1000,5))];code,preview=self.upload(files)
        self.assertEqual(code,200,preview);self.assertEqual(preview['warnings'],0);self.assertEqual(preview['errors'],0)
        self.assertEqual(self.upload(files,preview['token'])[0],200)
        self.assertEqual(self.admin.req('/api/meters/'+p['id']+'/readings','POST',dict(at=iso(START+dt.timedelta(days=6)),value=3000))[0],201)

    def test_10_duplicate_conflicts_and_decreasing_values_rejected(self):
        p=self.meter();raw=self.template(p)
        for cells in [{'A15':iso(START),'B15':1},{'A15':iso(START+dt.timedelta(days=2)),'B15':50,'A16':iso(START+dt.timedelta(days=3)),'B16':40}]:
            code,preview=self.upload([('a.xlsx',filled(raw,cells))]);self.assertEqual(code,200,preview);self.assertGreater(preview['errors'],0)

    def test_11_reader_import_denied_and_missing_token_denied(self):
        p=self.meter();files=[('a.xlsx',self.good(p))]
        self.assertEqual(self.upload(files,client=self.reader)[0],403)
        self.assertEqual(self.upload(files,'')[0],409)

    def test_12_ambiguous_local_time_and_explicit_offset(self):
        p=self.meter(at='2026-10-01T00:00:00Z');raw=self.template(p)
        files=[('a.xlsx',filled(raw,{'A15':'25.10.2026 02:30:00','B15':100}))]
        self.assertGreater(self.upload(files)[1]['errors'],0)
        files=[('a.xlsx',filled(raw,{'A15':'2026-10-25T02:30:00+02:00','B15':100,'A16':'2026-10-25T02:30:00+01:00','B16':110}))]
        code,preview=self.upload(files);self.assertEqual(code,200,preview);self.assertEqual(preview['errors'],0)
        self.assertEqual(self.upload(files,preview['token'])[0],200)

    def test_13_old_device_template_cannot_cross_replacement(self):
        p=self.meter();raw=self.template(p)
        code,result=self.admin.req('/api/meters/'+p['id']+'/replacement','POST',dict(at=iso(START+dt.timedelta(days=5)),oldEndValue=50,newStartValue=0,device={'number':uuid.uuid4().hex},reason='Austausch prüfen',version=1))
        self.assertEqual(code,200,result)
        code,preview=self.upload([('old.xlsx',filled(raw,{'A15':iso(START+dt.timedelta(days=10)),'B15':60}))]);self.assertEqual(code,200,preview);self.assertGreater(preview['errors'],0)

    def test_14_customer_user_can_download_and_import_own_meter(self):
        p=self.meter();writer=Client();self.assertEqual(writer.login('ablesung@nordwerk.example',NEW_PASSWORD)[0],200)
        with writer.open.open(BASE+'/api/meters/'+p['id']+'/excel',timeout=30) as r:raw=r.read()
        files=[('kundenablesung.xlsx',filled(raw,{'A15':iso(START+dt.timedelta(days=5)),'B15':55}))]
        code,preview=self.upload(files,client=writer);self.assertEqual(code,200,preview);self.assertEqual(preview['errors'],0)
        code,result=self.upload(files,preview['token'],client=writer);self.assertEqual(code,200,result)
        self.assertEqual(self.readings(p)[0]['reading']['createdBy'],writer.req('/api/auth/me')[1]['id'])

if __name__=='__main__':unittest.main(verbosity=2)
