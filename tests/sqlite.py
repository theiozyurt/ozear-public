"""Validate the real SQLite migration without a network or ORM dependency."""
import sqlite3
import json
from pathlib import Path
import unittest

class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        root = Path(__file__).parent.parent/'drizzle'
        for entry in json.loads((root/'meta/_journal.json').read_text())['entries']:
            self.db.executescript((root/(entry['tag']+'.sql')).read_text())
        self.db.execute("INSERT INTO projects(id,owner,name,description,created_at) VALUES ('p','owner','Project','','2026-11-17')")
    def create_ticket(self, key=None, owner='owner'):
        return self.db.execute("INSERT INTO issues(owner,project_id,title,created_at,updated_at,request_key) VALUES (?,'p','Ticket','t','t',?)", (owner,key)).lastrowid
    def test_ticket_defaults(self):
        self.create_ticket()
        self.assertEqual(self.db.execute('SELECT status,priority FROM issues').fetchone(), ('backlog','normal'))
    def test_ticket_retry_key_is_unique_per_owner(self):
        self.create_ticket('retry')
        with self.assertRaises(sqlite3.IntegrityError): self.create_ticket('retry')
        self.create_ticket('retry', 'another-owner')
    def test_independent_tickets_allow_missing_retry_keys(self):
        self.assertNotEqual(self.create_ticket(), self.create_ticket())
    def test_invalid_project_reference_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO issues(owner,project_id,title,created_at,updated_at) VALUES ('owner','missing','Ticket','t','t')")
    def test_worklog_retry_is_unique(self):
        issue = self.create_ticket()
        self.db.execute("INSERT INTO worklogs(id,owner,issue_id,summary,created_at,request_key) VALUES ('a','owner',?,'Note','t','note-retry')", (issue,))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO worklogs(id,owner,issue_id,summary,created_at,request_key) VALUES ('b','owner',?,'Note','t','note-retry')", (issue,))
    def test_note_for_missing_ticket_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO worklogs(id,owner,issue_id,summary,created_at) VALUES ('a','owner',999,'Note','t')")
    def test_query_plans_avoid_sort_trees(self):
        queries=[("issues", "owner='owner'", "updated_at", "issues_owner_updated"),("issues", "owner='owner' AND project_id='p'", "updated_at", "issues_owner_project_updated"),("worklogs", "owner='owner' AND issue_id=1", "created_at", "worklogs_owner_issue_created")]
        for table,where,order,index in queries:
            plan=str(self.db.execute(f"EXPLAIN QUERY PLAN SELECT * FROM {table} WHERE {where} ORDER BY {order} DESC").fetchall())
            self.assertIn(index,plan)
            self.assertNotIn('TEMP B-TREE',plan)
    def tearDown(self): self.db.close()

if __name__ == '__main__': unittest.main(verbosity=2)
