"""Deterministic contract tests, not multilingual retrieval or live acceptance."""
import copy
import os
import unittest
from unittest.mock import patch
from src.api.course_context import issue_context, resolve_context, catalog_revision, localized_place


class CourseContextTest(unittest.TestCase):
    def setUp(self):
        self.env=patch.dict(os.environ,{'KRIDE_COURSE_SIGNING_KEY':'k'*40});self.env.start();self.addCleanup(self.env.stop)
        self.catalog={i:{'id':i,'name':i,'lat':37.55,'lon':126.98,'address':'서울','sourceUrl':'https://example.test/'+i} for i in ['first','second']}

    def test_order_and_identity_survive(self):
        issued=issue_context('7',['second','first'],self.catalog,now=100)
        record,places=resolve_context(issued['courseContext'],'7',self.catalog,now=101)
        self.assertEqual([p['id'] for p in places],['second','first'])
        self.assertEqual(record['itineraryId'],issued['itineraryId'])

    def test_other_user_and_tampering_rejected(self):
        token=issue_context('7',['first'],self.catalog,now=100)['courseContext']
        for bad,user in [(token,'8'),('x'+token,'7'),(token+'.extra','7'),('garbage','7')]:
            with self.subTest(user=user,token=bad[:10]),self.assertRaises(ValueError):resolve_context(bad,user,self.catalog,now=101)

    def test_expiry_and_revocation_rejected(self):
        token=issue_context('7',['first'],self.catalog,now=100)['courseContext']
        with self.assertRaises(ValueError):resolve_context(token,'7',self.catalog,now=3700)
        for mutation in ['removed','coordinate','source']:
            catalog=copy.deepcopy(self.catalog)
            if mutation=='removed':catalog.pop('first')
            elif mutation=='coordinate':catalog['first']['lat']=37.6
            else:catalog['first']['sourceUrl']='https://example.test/new'
            with self.subTest(mutation=mutation),self.assertRaises(ValueError):resolve_context(token,'7',catalog,now=101)

    def test_duplicate_unknown_and_empty_ids_rejected(self):
        for ids in [[],['first','first'],['unknown']]:
            with self.subTest(ids=ids),self.assertRaises(ValueError):issue_context('7',ids,self.catalog,now=100)

    def test_volatile_fetch_time_does_not_change_revision(self):
        c=copy.deepcopy(self.catalog);c['first']['verifiedAt']='a later API poll'
        self.assertEqual(catalog_revision(c),catalog_revision(self.catalog))

    def test_only_verified_translation_and_same_coordinates(self):
        p={**self.catalog['first'],'names':{'ja':{'value':'場所','status':'verified'},'en':{'value':'invented','status':'pending'}}}
        ja=localized_place(p,'ja');en=localized_place(p,'en')
        self.assertEqual(ja['displayName'],'場所');self.assertEqual(ja['id'],p['id']);self.assertEqual(ja['lat'],p['lat'])
        self.assertEqual(en['displayName'],p['name']);self.assertFalse(en['translationVerified'])


if __name__=='__main__':unittest.main()
