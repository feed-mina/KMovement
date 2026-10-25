import json
import unittest
from unittest.mock import Mock
from deploy.hostinger.snapshot_identity_branches import SQL,snapshot


class SnapshotTests(unittest.TestCase):
    def test_repeatable_read_only_and_non_ugc_metadata(self):
        self.assertIn("REPEATABLE READ READ ONLY",SQL)
        self.assertIn("ROLLBACK",SQL)
        self.assertIn("p.source <> 'UGC'",SQL)
        self.assertNotIn("submitted_by",SQL)
        self.assertNotIn("reviewed_by",SQL)
        self.assertNotIn("tel",SQL)
        self.assertNotIn("DELETE ",SQL)
        self.assertNotIn("UPDATE ",SQL)
        self.assertNotIn("INSERT ",SQL)

    def test_full_master_keeps_observed_id(self):
        data=dict(contract="kride-identity-branch-snapshot-v1",allArtistCount=1,
                  data=dict(items=[dict(id=973,slug="IU",approvedYn="N")]))
        run=Mock(return_value=Mock(returncode=0,stdout=json.dumps(data)))
        self.assertEqual(snapshot(run,lambda:"srv1869569"),data)
        self.assertEqual(run.call_args.kwargs["input"],SQL)

    def test_unexpected_host_does_not_run_database_command(self):
        run=Mock()
        with self.assertRaisesRegex(RuntimeError,"unexpected_host"):
            snapshot(run,lambda:"other")
        run.assert_not_called()

    def test_query_failure_is_not_returned_as_empty_data(self):
        with self.assertRaisesRegex(RuntimeError,"snapshot_failed"):
            snapshot(Mock(return_value=Mock(returncode=1)),lambda:"srv1869569")

    def test_partial_master_is_rejected(self):
        data=dict(contract="kride-identity-branch-snapshot-v1",allArtistCount=2,
                  data=dict(items=[]))
        with self.assertRaisesRegex(RuntimeError,"invalid_snapshot"):
            snapshot(Mock(return_value=Mock(returncode=0,stdout=json.dumps(data))),lambda:"srv1869569")


if __name__ == "__main__":
    unittest.main()
