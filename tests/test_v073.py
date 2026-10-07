import unittest
from mmsm.web import session_cookies
import test_manager as support


class CookieParser(unittest.TestCase):
    def test_unrelated_json_cookies_do_not_hide_session(self):
        token = 'a' * 43
        for other in ('_sec_id={"username":"example"}', 'broken', 'tracking="unterminated'):
            for raw in (other + '; mmsm_session=' + token,
                        'mmsm_session=' + token + '; ' + other):
                self.assertEqual(session_cookies([raw]), {'mmsm_session': token})

    def test_duplicate_names_and_invalid_tokens_are_not_accepted(self):
        token = 'a' * 43
        for headers in ([f'mmsm_session={token}; mmsm_session={token}'],
                        [f'mmsm_session={token}', 'mmsm_session=invalid'],
                        ['mmsm_session=invalid'], ['mmsm_session="unfinished']):
            self.assertEqual(session_cookies(headers), {})
        self.assertEqual(session_cookies([f'mmsm_session="{token}"']), {'mmsm_session': token})


class DomainCookies(support.HTTPTests):
    test_setup_auth_csrf_roles_and_session_revocation = None
    test_settings_persist_and_static_security_headers = None
    test_login_rate_limit = None
    test_operator_cannot_install_or_modify_files = None

    def test_https_login_settings_password_and_logout_with_parent_domain_cookie(self):
        self.owner()
        self.web.origin = 'https://mmsm.example.com'
        origin = {'Host': 'mmsm.example.com', 'Origin': self.web.origin}
        unrelated = '_sec_id={"username":"example"}; analytics=ok; '

        def login(password):
            code, body, headers = self.request('/api/login', 'POST',
                {'username': 'owner', 'password': password}, origin)
            self.assertEqual(code, 200, body)
            self.assertIn('; Secure', headers['Set-Cookie'])
            self.token = unrelated + headers['Set-Cookie'].split(';')[0]
            self.csrf = body['csrf']
            code, me, _ = self.request('/api/me', headers={'Host': 'mmsm.example.com'})
            self.assertEqual(code, 200, me)
            self.assertEqual(me['csrf'], self.csrf)

        login('correct-horse-battery')
        self.assertEqual(self.request('/api/settings', 'PUT', {'public_origin': self.web.origin}, origin)[0], 200)
        self.assertEqual(self.request('/api/logout', 'POST', {}, {**origin, 'X-CSRF-Token': 'wrong'})[0], 403)
        self.assertEqual(self.request('/api/logout', 'POST', {}, {**origin, 'Origin': 'https://evil.test'})[0], 403)
        code, body, _ = self.request('/api/password', 'POST',
            {'current': 'correct-horse-battery', 'password': 'another-password-123'}, origin)
        self.assertEqual(code, 200, body)
        self.assertEqual(self.request('/api/me', headers=origin)[0], 401)
        login('another-password-123')
        self.assertEqual(self.request('/api/logout', 'POST', {}, origin)[0], 200)
        self.assertEqual(self.request('/api/me', headers=origin)[0], 401)
