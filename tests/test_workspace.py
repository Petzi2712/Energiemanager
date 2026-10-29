"""Version 0.3: reale Persistenz, Löschprotokolle, Branding und Zeitreihen."""
import datetime as dt
import json
import unittest
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from test_api import Client, BASE, NEW_PASSWORD

UTC = dt.timezone.utc
NOW = dt.datetime.now(UTC).replace(microsecond=0)
START = NOW - dt.timedelta(days=10)
def iso(value): return value.isoformat().replace('+00:00', 'Z')

class WorkspaceIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin = Client()
        assert cls.admin.login('admin@sysdatiq.local', NEW_PASSWORD)[0] == 200
        customers = cls.admin.req('/api/customers/')[1]
        cls.a = next(x for x in customers if x['number'] == 'DEMO-001')
        cls.b = next(x for x in customers if x['number'] == 'DEMO-002')
        tree = cls.admin.req('/api/technical/' + cls.a['id'] + '/tree')[1]
        cls.site = next(x['node'] for x in tree['nodes'] if x['node']['number'] == 'HB-01')
        cls.site2 = next(x['node'] for x in tree['nodes'] if x['node']['number'] == 'HB-02')
        cls.reader = Client(); assert cls.reader.login('lesen@weserpark.example', NEW_PASSWORD)[0] == 200

    def meter(self, initial=0, at=START, **kwargs):
        tag = uuid.uuid4().hex[:10]
        body = dict(number='W-' + tag, name='Testzähler ' + tag, nodeId=self.site['id'], parentPointId=None, at=iso(at), device={'number': 'D-' + tag}, initialValue=initial)
        body.update(kwargs)
        code, p = self.admin.req('/api/meters/?customerId=' + self.a['id'], 'POST', body)
        self.assertEqual(code, 201, p); return p

    def reading(self, p, value, at=NOW, **kwargs):
        body = dict(at=iso(at), value=value); body.update(kwargs)
        code, r = self.admin.req('/api/meters/' + p['id'] + '/readings', 'POST', body)
        self.assertEqual(code, 201, r); return r

    def detail(self, p):
        code, r = self.admin.req('/api/meters/' + p['id']); self.assertEqual(code, 200, r); return r

    def series(self, p, start=START, end=NOW, bucket='Day'):
        query = urllib.parse.urlencode(dict(from_=iso(start), to=iso(end), bucket=bucket)).replace('from_=', 'from=')
        code, r = self.admin.req('/api/meters/' + p['id'] + '/series?' + query)
        self.assertEqual(code, 200, r); return r

    def upload(self, path, client=None):
        client = client or self.admin
        image = Path('../frontend/e2e/fixtures/meter.png').read_bytes()
        boundary = 'boundary-' + uuid.uuid4().hex
        body = ('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="foto.png"\r\nContent-Type: image/png\r\n\r\n').encode() + image + ('\r\n--' + boundary + '--\r\n').encode()
        if client.csrf is None: client.csrf = client.req('/api/auth/csrf')[1]['token']
        req = urllib.request.Request(BASE + path, method='POST', headers={'Content-Type': 'multipart/form-data; boundary=' + boundary, 'X-CSRF-TOKEN': client.csrf}, data=body)
        try: response = client.open.open(req, timeout=30)
        except urllib.error.HTTPError as e: response = e
        with response: return response.status, json.load(response)

    def test_01_branding_public_admin_validation_and_conflict(self):
        code, before = Client().req('/api/branding'); self.assertEqual(code, 200)
        self.assertEqual(self.reader.req('/api/branding', 'PUT', dict(motto='Fremde Änderung', version=before['version']))[0], 403)
        self.assertEqual(self.admin.req('/api/branding', 'PUT', dict(motto='', version=before['version']))[0], 400)
        body = dict(motto='Testenergie verstehen.\nBetriebe verbessern.', version=before['version'])
        self.assertEqual(self.admin.req('/api/branding', 'PUT', body)[0], 200)
        self.assertEqual(Client().req('/api/branding')[1]['motto'], body['motto'])
        self.assertEqual(self.admin.req('/api/branding', 'PUT', body)[0], 409)
        version = Client().req('/api/branding')[1]['version']
        self.assertEqual(self.admin.req('/api/branding', 'PUT', dict(motto=before['motto'], version=version))[0], 200)

    def test_02_logo_upload_public_read_and_restore(self):
        before = Client().req('/api/branding')[1]
        self.assertEqual(self.upload('/api/branding/logo?version=' + str(before['version']), self.reader)[0], 403)
        code, r = self.upload('/api/branding/logo?version=' + str(before['version']))
        self.assertEqual(code, 200, r)
        brand = Client().req('/api/branding')[1]; self.assertIsNotNone(brand['logo'])
        with Client().open.open(BASE + brand['logo']) as response:
            self.assertEqual(response.headers['Content-Type'], 'image/png'); self.assertTrue(response.read().startswith(b'\x89PNG'))
        self.assertEqual(self.admin.req('/api/branding/logo?version=' + str(r['version']), 'DELETE')[0], 200)
        self.assertIsNone(Client().req('/api/branding')[1]['logo'])

    def test_03_darkmode_saved_per_account(self):
        self.assertEqual(self.admin.req('/api/account/appearance', 'PUT', {'darkMode': True})[0], 200)
        other = Client(); self.assertEqual(other.login('admin@sysdatiq.local', NEW_PASSWORD)[0], 200)
        self.assertTrue(other.req('/api/auth/me')[1]['darkMode'])
        self.assertFalse(self.reader.req('/api/auth/me')[1]['darkMode'])
        self.assertEqual(self.admin.req('/api/account/appearance', 'PUT', {'darkMode': False})[0], 200)

    def test_04_fleet_crud_scope_and_log(self):
        tag = uuid.uuid4().hex[:10]; path = '/api/fleet/' + self.a['id'] + '/'
        body = dict(number=tag, name='Elektrotransporter', plate='HB-TEST 1', siteId=self.site['id'], driveType='Elektro', fuel='Strom', initialMileage=12000, batteryKwh=75)
        foreign = dict(body, siteId=next(x['node']['id'] for x in self.admin.req('/api/technical/' + self.b['id'] + '/tree')[1]['nodes'] if x['node']['kind'] == 'Site'))
        self.assertEqual(self.admin.req(path, 'POST', foreign)[0], 400)
        code, v = self.admin.req(path, 'POST', body); self.assertEqual(code, 201, v)
        self.assertEqual(self.reader.req(path)[0], 404)
        self.assertEqual(self.reader.req(path + v['id'], 'DELETE', dict(version=1, reason='Kein Zugriff'))[0], 403)
        self.assertEqual(self.admin.req(path, 'POST', body)[0], 409)
        v['name'] = 'Neuer Fahrzeugname'; code, updated = self.admin.req(path + v['id'], 'PUT', v); self.assertEqual(code, 200, updated)
        self.assertEqual(self.admin.req(path + v['id'], 'PUT', v)[0], 409)
        self.assertEqual(self.admin.req(path + v['id'], 'DELETE', dict(version=2, reason='x'))[0], 400)
        self.assertEqual(self.admin.req(path + v['id'], 'DELETE', dict(version=2, reason='Fahrzeug verkauft'))[0], 200)
        self.assertNotIn(v['id'], [x['id'] for x in self.admin.req(path)[1]])
        audit = self.admin.req('/api/audit')[1]; event = next(x for x in audit if x['action'] == 'Fahrzeug.Gelöscht' and x['target'] == v['id'])
        self.assertIn('Fahrzeug verkauft', event['details'])

    def test_05_meter_delete_hidden_and_audited(self):
        p = self.meter(); self.reading(p, 100)
        self.assertEqual(self.admin.req('/api/meters/' + p['id'], 'DELETE', dict(version=1, reason='Doppelte Messstelle'))[0], 409)
        self.assertEqual(self.reader.req('/api/meters/' + p['id'], 'DELETE', dict(version=2, reason='Doppelte Messstelle'))[0], 403)
        self.assertEqual(self.admin.req('/api/meters/' + p['id'], 'DELETE', dict(version=2, reason='Doppelte Messstelle'))[0], 200)
        self.assertEqual(self.admin.req('/api/meters/' + p['id'])[0], 404)
        tree = self.admin.req('/api/technical/' + self.a['id'] + '/tree')[1]
        self.assertNotIn(p['id'], [x['point']['id'] for x in tree['points']])
        event = next(x for x in self.admin.req('/api/audit')[1] if x['action'] == 'Messstelle.Gelöscht' and x['target'] == p['id'])
        self.assertIn('Doppelte Messstelle', event['details']); self.assertEqual(json.loads(event['details'])['readings'], 2)

    def test_06_parent_delete_requires_children_move_or_delete(self):
        parent = self.meter(); child = self.meter(parentPointId=parent['id'])
        self.assertEqual(self.admin.req('/api/meters/' + parent['id'], 'DELETE', dict(version=1, reason='Stillgelegt'))[0], 400)
        self.assertEqual(self.admin.req('/api/meters/' + child['id'], 'DELETE', dict(version=1, reason='Stillgelegt'))[0], 200)
        self.assertEqual(self.admin.req('/api/meters/' + parent['id'], 'DELETE', dict(version=1, reason='Stillgelegt'))[0], 200)

    def test_07_documents_delete_scope_and_download_revoked(self):
        code, doc = self.upload('/api/documents?nodeId=' + self.site['id']); self.assertEqual(code, 201, doc)
        self.assertEqual(self.reader.req('/api/documents/' + doc['id'], 'DELETE')[0], 403)
        self.assertEqual(self.admin.req('/api/documents/' + doc['id'], 'DELETE')[0], 200)
        self.assertEqual(self.admin.req('/api/documents/' + doc['id'])[0], 404)
        self.assertNotIn(doc['id'], [x['id'] for x in self.admin.req('/api/documents?nodeId=' + self.site['id'])[1]])
        p = self.meter(); r = self.detail(p)['readings'][0]['reading']
        code, photo = self.upload('/api/documents?readingId=' + r['id']); self.assertEqual(code, 201, photo)
        writer = Client(); self.assertEqual(writer.login('ablesung@nordwerk.example', NEW_PASSWORD)[0], 200)
        self.assertEqual(writer.req('/api/documents/' + photo['id'], 'DELETE')[0], 200)
        self.assertEqual(self.detail(p)['documents'], [])

    def test_08_series_default_30days_and_no_extrapolation(self):
        p = self.meter(); self.reading(p, 100)
        code, r = self.admin.req('/api/meters/' + p['id'] + '/series'); self.assertEqual(code, 200, r)
        duration = dt.datetime.fromisoformat(r['to']) - dt.datetime.fromisoformat(r['from'])
        self.assertEqual(duration, dt.timedelta(days=30)); self.assertEqual(r['bucket'], 'Day')
        self.assertIsNone(r['consumption']); self.assertAlmostEqual(r['availableConsumption'], 100)
        self.assertTrue(any(b['availableConsumption'] is None for b in r['buckets']))

    def test_09_series_interpolation_factor_and_total_conservation(self):
        p = self.meter(device={'number': uuid.uuid4().hex, 'factor': 2}); self.reading(p, 100)
        r = self.series(p, START + dt.timedelta(days=1), START + dt.timedelta(days=9))
        self.assertEqual(r['status'], 'Zeitanteilig'); self.assertEqual(r['consumption'], 160); self.assertEqual(r['coverage'], 1)
        self.assertAlmostEqual(sum(x['consumption'] for x in r['buckets']), 160)
        self.assertEqual(r['unassignedConsumption'], 160)
        for bucket in ['Week', 'Month', 'Year', 'Total']:
            grouped = self.series(p, START, NOW, bucket); self.assertEqual(grouped['consumption'], 200)
            self.assertAlmostEqual(sum(x['consumption'] for x in grouped['buckets']), 200)

    def test_10_series_direct_children_no_grandchild_double_count(self):
        parent = self.meter(); child = self.meter(parentPointId=parent['id']); grandchild = self.meter(parentPointId=child['id'])
        self.reading(parent, 100); self.reading(child, 70); self.reading(grandchild, 20)
        r = self.series(parent); self.assertEqual(r['consumption'], 100); self.assertEqual(r['submeterTotal'], 70); self.assertEqual(r['unassignedConsumption'], 30)
        self.assertEqual(len(r['children']), 1)

    def test_11_series_replacement_and_missing_exchange_values(self):
        p = self.meter(); at = START + dt.timedelta(days=5)
        code, r = self.admin.req('/api/meters/' + p['id'] + '/replacement', 'POST', dict(at=iso(at), oldEndValue=50, newStartValue=10, device={'number': uuid.uuid4().hex, 'factor': 2}, reason='Austausch im Test', version=1))
        self.assertEqual(code, 200, r); self.reading(p, 20)
        self.assertEqual(self.series(p)['consumption'], 70)
        q = self.meter()
        code, r = self.admin.req('/api/meters/' + q['id'] + '/replacement', 'POST', dict(at=iso(at), oldEndValue=None, newStartValue=10, device={'number': uuid.uuid4().hex, 'factor': 2}, reason='Wert fehlt im Test', version=1, confirmIncomplete=True))
        self.assertEqual(code, 200, r); self.reading(q, 20)
        result = self.series(q); self.assertIsNone(result['consumption']); self.assertEqual(result['availableConsumption'], 20); self.assertEqual(result['coverage'], .5)

    def test_12_series_daylight_saving_calendar_days(self):
        for start, hours in [(dt.datetime(2026, 3, 28, 23, tzinfo=UTC), [23, 24]), (dt.datetime(2026, 10, 24, 22, tzinfo=UTC), [25, 24])]:
            p = self.meter(at=start); end = start + dt.timedelta(hours=sum(hours)); self.reading(p, sum(hours), at=end)
            r = self.series(p, start, end)
            self.assertEqual(len(r['buckets']), 2); self.assertEqual([b['consumption'] for b in r['buckets']], hours)

    def test_13_assignment_history_changes_balance_only_from_move(self):
        parent = self.meter(); child = self.meter(); at = START + dt.timedelta(days=5)
        self.reading(child, 50, at=at - dt.timedelta(seconds=1))
        version = self.detail(child)['point']['version']
        code, r = self.admin.req('/api/meters/' + child['id'] + '/assignment', 'POST', dict(nodeId=self.site['id'], parentPointId=parent['id'], at=iso(at), version=version))
        self.assertEqual(code, 200, r); self.reading(child, 100); self.reading(parent, 200)
        result = self.series(parent)
        self.assertAlmostEqual(result['submeterTotal'], 50 * (5 * 86400) / (5 * 86400 + 1), places=5)

    def test_14_series_scope_and_invalid_ranges(self):
        p = self.meter(); self.reading(p, 100)
        self.assertEqual(self.reader.req('/api/meters/' + p['id'] + '/series')[0], 404)
        self.assertEqual(self.admin.req('/api/meters/' + p['id'] + '/series?bucket=Bad')[0], 400)
        self.assertEqual(self.admin.req('/api/meters/' + p['id'] + '/series?from=' + iso(NOW) + '&to=' + iso(START))[0], 400)
        self.assertEqual(self.admin.req('/api/meters/' + p['id'] + '/series?from=2020-01-01T00:00:00Z&bucket=Day')[0], 400)

    def test_15_generation_hardware_and_customer_dashboard(self):
        tree = self.admin.req('/api/technical/' + self.a['id'] + '/tree')[1]
        building = next(x['node'] for x in tree['nodes'] if x['node']['kind'] == 'Building')
        code, r = self.admin.req('/api/technical/' + self.a['id'] + '/nodes', 'POST', dict(number=uuid.uuid4().hex, name='PV-Anlage', parentId=building['id'], kind='ConsumerAsset', assetType='Photovoltaik', assetRole='Generation', quantity=1, ratedPowerW=30000, annualHours=900, loadFactor=1))
        self.assertEqual(code, 201, r); self.assertEqual(r['estimatedAnnualKwh'], 27000)
        code, dash = self.admin.req('/api/dashboard?customerId=' + self.b['id']); self.assertEqual(code, 200, dash); self.assertEqual(dash['customers'], 1)

    def test_16_historical_site_scope_does_not_leak_neighbor_readings(self):
        p = self.meter(); self.reading(p, 100, at=START + dt.timedelta(days=4))
        at = START + dt.timedelta(days=5)
        code, r = self.admin.req('/api/meters/' + p['id'] + '/assignment', 'POST', dict(nodeId=self.site2['id'], parentPointId=None, at=iso(at), version=2))
        self.assertEqual(code, 200, r); self.reading(p, 200)
        email = 'series-scope-' + uuid.uuid4().hex[:8] + '@example.test'
        code, user = self.admin.req('/api/users/', 'POST', dict(email=email, name='Standortleser', role='Reader', customerIds=[self.a['id']]))
        self.assertEqual(code, 201, user)
        self.assertEqual(self.admin.req('/api/users/' + user['id'] + '/site-access', 'PUT', dict(customerId=self.a['id'], restricted=True, siteIds=[self.site2['id']]))[0], 200)
        limited = Client(); self.assertEqual(limited.login(email, 'Start_Energie')[0], 200); self.assertEqual(limited.change()[0], 200)
        path = '/api/meters/' + p['id'] + '/series?'
        query = urllib.parse.urlencode({'from': iso(START + dt.timedelta(days=6)), 'to': iso(NOW)})
        code, result = limited.req(path + query); self.assertEqual(code, 200, result); self.assertIsNone(result['availableConsumption'])
        self.assertEqual(limited.req(path + urllib.parse.urlencode({'from': iso(START), 'to': iso(NOW)}))[0], 403)
        self.reading(p, 140, at=START + dt.timedelta(days=6))
        code, result = limited.req(path + query); self.assertEqual(code, 200, result); self.assertEqual(result['consumption'], 60)

    def test_17_deleted_submeter_remains_in_historical_balance(self):
        parent = self.meter(); child = self.meter(parentPointId=parent['id'])
        self.reading(parent, 100); self.reading(child, 60)
        self.assertEqual(self.admin.req('/api/meters/' + child['id'], 'DELETE', dict(version=2, reason='Historische Löschung testen'))[0], 200)
        result = self.series(parent); self.assertEqual(result['submeterTotal'], 60); self.assertEqual(result['unassignedConsumption'], 40)

if __name__ == '__main__': unittest.main(verbosity=2)
