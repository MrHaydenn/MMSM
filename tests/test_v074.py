import json
from unittest.mock import patch
import test_manager as support
from mmsm.store import Store, GITHUB_UPDATE_FEED


class GitHubUpdates(support.Base):
    def test_default_github_feed_and_notification(self):
        self.assertEqual(self.store.settings()['update_feed'], GITHUB_UPDATE_FEED)
        manifest = {'version': '99.0.0', 'url': 'https://github.com/MrHaydenn/MMSM/releases/download/v99.0.0/MMSM-99.0.0-update.zip', 'sha256': 'a' * 64}
        with patch('mmsm.updater.fetch', return_value=json.dumps(manifest).encode()) as fetch:
            self.assertEqual(self.manager.updater.check()['status'], 'available')
            fetch.assert_called_once_with(GITHUB_UPDATE_FEED, 256 * 1024)
        self.assertEqual(len(self.store.rows("SELECT * FROM notifications WHERE kind='wrapper'")), 1)

    def test_blank_migration_custom_feed_and_opt_out(self):
        for feed in ('', 'https://example.com/latest.json'):
            self.store.set_settings({'update_feed': feed, 'wrapper_update_checks': False})
            self.store.execute("DELETE FROM settings WHERE key='_github_feed_migrated'")
            reopened = Store(self.store.root)
            self.assertEqual(reopened.settings()['update_feed'], feed or GITHUB_UPDATE_FEED)
            self.assertFalse(reopened.settings()['wrapper_update_checks'])
            reopened.set_settings({'update_feed': ''})
            reopened.db.close()
            again = Store(self.store.root)
            self.assertEqual(again.settings()['update_feed'], '')
            again.db.close()
