import test_manager as support
from mmsm.store import Problem

class UsernameCase(support.Base):
    def test_registration_preserves_case_login_ignores_case_and_duplicates_blocked(self):
        owner=self.store.add_user('MrHaydenn','correct-horse-battery','owner',first=True)
        self.assertEqual(owner['username'],'MrHaydenn')
        for spelling in ('mrhaydenn','MRHAYDENN','mRhAyDeNn'):
            user,token,_=self.store.login(spelling,'correct-horse-battery')
            self.assertEqual(user['username'],'MrHaydenn')
            self.assertEqual(self.store.session(token)['username'],'MrHaydenn')
        with self.assertRaises(Problem):self.store.add_user('mrhaydenn','correct-horse-battery','viewer')
        with self.assertRaises(Problem):self.store.login('MRHAYDENN','Correct-Horse-Battery')
