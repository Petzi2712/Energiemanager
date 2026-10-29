"""Integrationstests mit realer API und PostgreSQL; nur frische Testdaten verwenden."""
import http.cookiejar
import json
import os
import re
import time
import unittest
import urllib.error
import urllib.request
import uuid

BASE = os.getenv('TEST_BASE_URL', 'http://127.0.0.1:8080').rstrip('/')
MAIL = os.getenv('MAIL_BASE_URL', 'http://127.0.0.1:8025').rstrip('/')
NEW_PASSWORD = 'Test_Energie_2026!'

class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.open = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = None

    def req(self, path, method='GET', data=None, csrf=True):
        if method != 'GET' and csrf and self.csrf is None:
            code, body = self.req('/api/auth/csrf')
            assert code == 200, body
            self.csrf = body['token']
        headers = {'Content-Type': 'application/json'}
        if method != 'GET' and csrf:
            headers['X-CSRF-TOKEN'] = self.csrf
        request = urllib.request.Request(BASE + path, method=method, headers=headers,
            data=json.dumps(data).encode() if data is not None else None)
        try:
            response = self.open.open(request, timeout=20)
        except urllib.error.HTTPError as e:
            response = e
        with response:
            raw = response.read()
            try:
                body = json.loads(raw)
            except ValueError:
                body = raw.decode(errors='replace')
            return response.status, body

    def login(self, email, password):
        result = self.req('/api/auth/login', 'POST', {'email': email, 'password': password})
        self.csrf = None
        return result

    def change(self):
        result = self.req('/api/auth/password', 'POST', {'currentPassword': 'Start_Energie', 'newPassword': NEW_PASSWORD})
        self.csrf = None
        return result

class ApiIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for _ in range(40):
            try:
                if Client().req('/api/health')[0] == 200:
                    break
            except OSError:
                pass
            time.sleep(1)
        else:
            raise RuntimeError('API nicht bereit')
        cls.admin, cls.user_a, cls.reader_b, cls.customer_admin = Client(), Client(), Client(), Client()
        for client, email in [(cls.admin, 'admin@sysdatiq.local'), (cls.user_a, 'ablesung@nordwerk.example'),
                             (cls.reader_b, 'lesen@weserpark.example'), (cls.customer_admin, 'admin@nordwerk.example')]:
            code, user = client.login(email, 'Start_Energie')
            assert code == 200, user
            assert user['mustChangePassword'], 'Tests brauchen eine frische, isolierte Demo-Datenbank.'
            assert client.req('/api/customers/')[0] == 403
            assert client.change()[0] == 200
        rows = cls.admin.req('/api/customers/')[1]
        cls.a = next(c for c in rows if c['number'] == 'DEMO-001')
        cls.b = next(c for c in rows if c['number'] == 'DEMO-002')

    def new_user(self):
        email = f'test-{uuid.uuid4().hex[:12]}@example.test'
        status, user = self.admin.req('/api/users/', 'POST', {'email': email, 'name': 'Integrationstest', 'role': 'CustomerUser', 'customerIds': [self.a['id']]})
        self.assertEqual(status, 201, user)
        return email, user['id']

    def test_01_password_gate(self):
        self.assertFalse(self.admin.req('/api/auth/me')[1]['mustChangePassword'])

    def test_02_database_health(self):
        self.assertEqual(Client().req('/api/health'), (200, {'status': 'ok', 'phase': 3, 'version': '0.3.0'}))

    def test_03_anonymous_denied(self):
        self.assertEqual(Client().req('/api/customers/')[0], 401)

    def test_04_tenant_isolation(self):
        self.assertEqual(self.user_a.req('/api/customers/' + self.b['id'])[0], 404)
        self.assertEqual(self.reader_b.req('/api/customers/' + self.a['id'])[0], 404)
        self.assertEqual(len(self.user_a.req('/api/customers/')[1]), 1)

    def test_05_readonly_authorization(self):
        self.assertEqual(self.reader_b.req('/api/customers/' + self.b['id'], 'PUT', self.b)[0], 403)
        self.assertEqual(self.user_a.req('/api/users/')[0], 403)
        self.assertEqual(self.reader_b.req('/api/audit')[0], 403)

    def test_06_customer_persistence_and_history(self):
        code, row = self.admin.req('/api/customers/', 'POST', {'number': 'TEST-' + uuid.uuid4().hex[:8], 'name': 'Persistenter Testkunde'})
        self.assertEqual(code, 201, row)
        original = dict(row)
        row['name'] = 'Geänderter Testkunde'
        code, changed = self.admin.req('/api/customers/' + row['id'], 'PUT', row)
        self.assertEqual(code, 200, changed)
        self.assertEqual(changed['version'], 2)
        self.assertEqual(self.admin.req('/api/customers/' + row['id'])[1]['name'], row['name'])
        self.assertEqual(self.admin.req('/api/customers/' + row['id'], 'PUT', original)[0], 409)
        events = self.admin.req('/api/audit?customerId=' + row['id'])[1]
        details = json.loads(next(e for e in events if e['action'] == 'Kunde.Geändert')['details'])
        self.assertEqual(details['before']['Name'], 'Persistenter Testkunde')
        self.assertEqual(details['after']['Name'], 'Geänderter Testkunde')

    def test_07_duplicates_and_input_validation(self):
        self.assertEqual(self.admin.req('/api/customers/', 'POST', self.a)[0], 409)
        for name in ['', 'A' * 201]:
            self.assertEqual(self.admin.req('/api/customers/', 'POST', {'number': 'X', 'name': name})[0], 400)

    def test_08_csrf(self):
        self.assertEqual(self.admin.req('/api/customers/', 'POST', {'number': 'NO-CSRF', 'name': 'Abgelehnt'}, csrf=False)[0], 400)

    def test_09_customeradmin_scope(self):
        self.assertEqual(self.customer_admin.req('/api/users/?customerId=' + self.a['id'])[0], 200)
        self.assertEqual(self.customer_admin.req('/api/users/?customerId=' + self.b['id'])[0], 403)
        self.assertEqual(self.customer_admin.req('/api/users/', 'POST', {'email': 'escalation@example.test', 'name': 'X', 'role': 'SystemAdmin', 'customerIds': [self.a['id']]})[0], 403)
        email = f'local-{uuid.uuid4().hex[:8]}@example.test'
        self.assertEqual(self.customer_admin.req('/api/users/', 'POST', {'email': email, 'name': 'Kundenleser', 'role': 'Reader', 'customerIds': [self.a['id']]})[0], 201)

    def test_10_deactivation_revokes_session(self):
        email, uid = self.new_user()
        browser = Client()
        self.assertEqual(browser.login(email, 'Start_Energie')[0], 200)
        self.assertEqual(browser.change()[0], 200)
        user = next(u for u in self.admin.req('/api/users/')[1] if u['id'] == uid)
        user['isActive'] = False
        self.assertEqual(self.admin.req('/api/users/' + uid, 'PUT', user)[0], 200)
        self.assertEqual(browser.req('/api/auth/me')[0], 401)

    def test_11_password_reset_mail_and_single_use(self):
        email, uid = self.new_user()
        browser = Client()
        self.assertEqual(browser.req('/api/auth/forgot', 'POST', {'email': email})[0], 200)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(MAIL + '/api/v1/messages', timeout=10) as r:
            listing = json.load(r)
        message = next(m for m in listing['messages'] if any(x['Address'] == email for x in m['To']))
        with opener.open(MAIL + '/api/v1/message/' + message['ID'], timeout=10) as r:
            content = json.load(r)
        token = re.search(r'reset=([A-F0-9]{64})', content['Text']).group(1)
        data = {'email': email, 'token': token, 'newPassword': NEW_PASSWORD}
        self.assertEqual(browser.req('/api/auth/reset', 'POST', data)[0], 200)
        self.assertEqual(browser.req('/api/auth/reset', 'POST', data)[0], 400)
        self.assertEqual(browser.login(email, NEW_PASSWORD)[0], 200)

    def test_12_account_lockout(self):
        email, uid = self.new_user()
        browser = Client()
        for _ in range(5):
            self.assertEqual(browser.login(email, 'Falsch')[0], 401)
        self.assertEqual(browser.login(email, 'Start_Energie')[0], 401)

    def test_13_logout(self):
        email, uid = self.new_user()
        browser = Client()
        self.assertEqual(browser.login(email, 'Start_Energie')[0], 200)
        self.assertEqual(browser.req('/api/auth/logout', 'POST', {})[0], 200)
        self.assertEqual(browser.req('/api/auth/me')[0], 401)

    def test_14_openapi_dashboard(self):
        status, doc = self.admin.req('/openapi/v1.json')
        self.assertEqual(status, 200, doc)
        self.assertIn('/api/customers', doc['paths'])
        self.assertGreaterEqual(self.admin.req('/api/dashboard')[1]['customers'], 2)

    def test_15_internal_notes(self):
        self.assertEqual(self.user_a.req('/api/customers/' + self.a['id'])[1]['notes'], '')
        self.assertTrue(self.admin.req('/api/customers/' + self.a['id'])[1]['notes'])

    def test_16_self_deactivation(self):
        me = self.admin.req('/api/auth/me')[1]
        user = next(u for u in self.admin.req('/api/users/')[1] if u['id'] == me['id'])
        user['isActive'] = False
        self.assertEqual(self.admin.req('/api/users/' + user['id'], 'PUT', user)[0], 400)

if __name__ == '__main__':
    unittest.main(verbosity=2)
