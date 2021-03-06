/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Mozilla Raindrop Code.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
 *
 **/

define(
  [
    'q',
    'rdcommon/log',
    'rdcommon/testcontext',
    'rdplat/gendb',
    'module',
    'exports'
  ],
  function(
    $Q,
    $log,
    $tc,
    $gendb,
    $module,
    exports
  ) {
const when = $Q.when;

var TD = exports.TD = $tc.defineTestsFor($module, $gendb.LOGFAB, null,
                                         ['util:db']);

const TBL_HUMANS = 'humans',
      IDX_NAME = 'name',
      IDX_AGE = 'age',
      TBQ_TODO = 'todo';

var dbSchema = {
  tables: [
    {
      name: TBL_HUMANS,
      columnFamilies: ['d'],
      indices: [
        IDX_NAME,
        IDX_AGE,
      ],
    },
  ],

  // XXX no queues for now, but we should test them
  queues: [
    {
      name: TBQ_TODO,
    },
  ],
};

TD.commonCase('hbase model', function(T) {
  // although the database connection has a logger, they're not really useful
  //  for correctness, just for knowing what's happening, so we create a lazy
  //  person's logger for the unit test.
  var eLazy = T.lazyLogger('db'), conn;

  // use a common rejection handler for everything.
  function badNews(err) {
    eLazy.error(err);
  }
  // helper to create a callback handler
  function logEvent(what) {
    return function() {
      eLazy.event(what);
    };
  };
  // helper to create a callback that logs the value passed to the callback
  //  using namedValue.  Strictly speaking, we don't need to provide the name
  //  because the testing framework enforces sequencing, I'm just trying to
  //  make the logs perhaps a bit more readable.
  function logNamedValue(name) {
    return function(val) {
      eLazy.namedValue(name, val);
    };
  };

  // - dynamic (updated by the actions as they run) state
  var dynA = {}, dynB = {}, dynD = {};

  T.group('setup');
  T.action(eLazy, 'create connection', function() {
    // good news everyone!  our main.js is currently racing us to create a
    //  database, so we get boned if we use the same empty prefix it uses!
    conn = $gendb.makeTestDBConnection('hbase');
  });
  T.action(eLazy, 'define schema', function() {
    eLazy.expect_event('schema defined');

    when(conn.defineSchema(dbSchema), logEvent('schema defined'), badNews);
  });

  T.group('row/cell basics');
  T.check(eLazy, 'nonexistent row cell is null', function() {
    eLazy.expect_namedValue('nope', null);
    when(conn.getRowCell(TBL_HUMANS, 'nope', 'whatevs'),
         logNamedValue('nope'), badNews);
  });
  T.check(eLazy, 'empty row cell is empty', function() {
    eLazy.expect_namedValue('nopenope', {});
    when(conn.getRow(TBL_HUMANS, 'nopenope', null),
         logNamedValue('nopenope'), badNews);
  });
  T.action(eLazy, 'put A, 1 cell', function() {
    eLazy.expect_event('did put A');
    dynA['d:name'] = 'Alice';
    when(conn.putCells(TBL_HUMANS, 'a', {'d:name': 'Alice'}),
         logEvent('did put A'), badNews);
  });
  T.check(eLazy, 'get A, check row has just one cell', function() {
    eLazy.expect_namedValue('a', dynA);
    when(conn.getRow(TBL_HUMANS, 'a', null),
         logNamedValue('a'), badNews);
  });
  T.action(eLazy, 'put B, 3 cells', function() {
    eLazy.expect_event('did put B');
    dynB['d:name'] = 'Bob';
    dynB['d:favColor'] = 'blue';
    dynB['d:favNumber'] = 11;
    when(conn.putCells(TBL_HUMANS, 'b',
                       {
                         'd:name': 'Bob',
                         'd:favColor': 'blue',
                         'd:favNumber': 11, // cause of the hex, get it?
                       }),
         logEvent('did put B'), badNews);
  });
  T.check(eLazy, 'get B, check row has the 3 cells', function() {
    eLazy.expect_namedValue('b', dynB);
    when(conn.getRow(TBL_HUMANS, 'b', null),
         logNamedValue('b'), badNews);
  });
  T.action(eLazy, 'put A, 1 other cell', function() {
    eLazy.expect_event('did put A');
    dynA['d:favNumber'] = 0;
    when(conn.putCells(TBL_HUMANS, 'a', {'d:favNumber': 0}),
         logEvent('did put A'), badNews);
  });
  T.check(eLazy, 'get A, check row has the 2 cells', function() {
    eLazy.expect_namedValue('a', dynA);
    when(conn.getRow(TBL_HUMANS, 'a', null),
         logNamedValue('a'), badNews);
  });
  T.check(eLazy, 'get A number cell, check', function() {
    eLazy.expect_namedValue('a[d:favNumber]', 0);
    when(conn.getRowCell(TBL_HUMANS, 'a', 'd:favNumber'),
         logNamedValue('a[d:favNumber]'), badNews);
  });

  T.group('boolean cell helpers');
  T.check(eLazy, 'boolcheck', function() {
    eLazy.expect_namedValue('bool(a[d:favNumber])', false);
    eLazy.expect_namedValue('bool(b[d:favNumber])', true);
    when(conn.boolcheckRowCell(TBL_HUMANS, 'a', 'd:favNumber'),
         logNamedValue('bool(a[d:favNumber])'), badNews);
    when(conn.boolcheckRowCell(TBL_HUMANS, 'b', 'd:favNumber'),
         logNamedValue('bool(b[d:favNumber])'), badNews);
  });
  T.check(eLazy, 'asserting boolcheck', function() {
    // we expect a rejection, but
    eLazy.expect_namedValue('assertBool(a[d:favNumber])', 'woo! exception!');
    eLazy.expect_namedValue('assertBool(b[d:favNumber])', true);
    when(conn.assertBoolcheckRowCell(TBL_HUMANS, 'a', 'd:favNumber'),
         badNews, // note: this is bad news for the callback case!
         function(err) {
           // and this is the rejection case!
           if (err instanceof Error)
             eLazy.namedValue('assertBool(a[d:favNumber])', 'woo! exception!');
           // the latter should not happen, but pass through so we can see it.
           else
             eLazy.namedValue('assertBool(a[d:favNumber])', err);
         });
    when(conn.assertBoolcheckRowCell(TBL_HUMANS, 'b', 'd:favNumber'),
         logNamedValue('assertBool(b[d:favNumber])'), badNews);
  });

  T.group('incrementing');
  T.action(eLazy, 'increment A fave number (tells us new value)', function() {
    eLazy.expect_namedValue('++a[d:favNumber]', 1);
    when(conn.incrementCell(TBL_HUMANS, 'a', 'd:favNumber', 1),
         logNamedValue('++a[d:favNumber]'), badNews);
  });
  // this is starting from non-zero, so is a bit more significant
  T.action(eLazy, 'increment B fave number (tells us new value)', function() {
    eLazy.expect_namedValue('++b[d:favNumber]', 12);
    when(conn.incrementCell(TBL_HUMANS, 'b', 'd:favNumber', 1),
         logNamedValue('++b[d:favNumber]'), badNews);
  });
  T.action(eLazy, 'increment non-previously-existing', function() {
    eLazy.expect_namedValue('++c[d:favNumber]', 1);
    when(conn.incrementCell(TBL_HUMANS, 'c', 'd:favNumber', 1),
         logNamedValue('++c[d:favNumber]'), badNews);
  });

  T.group('race semantics');
  T.action(eLazy, 'race succeeds first time', function() {
    eLazy.expect_event('raced');
    dynD['d:exists'] = 1;
    dynD['d:name'] = 'Doug';
    dynD['d:favNumber'] = -5;
    when(conn.raceCreateRow(TBL_HUMANS, 'd', 'd:exists',
                            {'d:name': 'Doug', 'd:favNumber': -5}),
         logEvent('raced'), badNews);
  });
  T.check(eLazy, 'race did the right thing', function() {
    eLazy.expect_namedValue('d', dynD);
    when(conn.getRow(TBL_HUMANS, 'd', null),
         logNamedValue('d'), badNews);
  });
  T.action(eLazy, 'race fails second time', function() {
    eLazy.expect_event('raced');
    // yes, this part does seem dumb now that I am typing this out, but hbase
    //  has really weak semantics, etc. etc.
    dynD['d:exists'] = 2;
    when(conn.raceCreateRow(TBL_HUMANS, 'd', 'd:exists',
                            {'d:name': 'Drug', 'd:favNumber': 55}),
         badNews, logEvent('raced'));

  });
  T.check(eLazy, 'race did not clobber stuffs', function() {
    eLazy.expect_namedValue('d', dynD);
    when(conn.getRow(TBL_HUMANS, 'd', null),
         logNamedValue('d'), badNews);
  });

  T.group('deletion');
  T.action(eLazy, 'delete a cell from A', function() {
    eLazy.expect_event('deleted');
    delete dynA['d:favNumber'];
    when(conn.deleteRowCell(TBL_HUMANS, 'a', 'd:favNumber'),
         logEvent('deleted'), badNews);
  });
  T.check(eLazy, 'cell got gone', function() {
    eLazy.expect_namedValue('a', dynA);
    when(conn.getRow(TBL_HUMANS, 'a', null),
         logNamedValue('a'), badNews);
  });
  T.action(eLazy, 'delete all of A', function() {
    eLazy.expect_event('deleted');
    dynA = {};
    when(conn.deleteRow(TBL_HUMANS, 'a'),
         logEvent('deleted'), badNews);
  });
  T.action(eLazy, 'all got gone', function() {
    eLazy.expect_namedValue('a', dynA);
    when(conn.getRow(TBL_HUMANS, 'a', null),
         logNamedValue('a'), badNews);
  });

  T.group('cleanup');
  T.cleanup(eLazy, 'cleanup', function() {
    $gendb.cleanupTestDBConnection(conn);
  });
});

TD.commonCase('reorderable collection index model', function(T) {
  // although the database connection has a logger, they're not really useful
  //  for correctness, just for knowing what's happening, so we create a lazy
  //  person's logger for the unit test.
  var eLazy = T.lazyLogger('db'), conn;

  // use a common rejection handler for everything.
  function badNews(err) {
    eLazy.error(err);
  }
  // helper to create a callback handler
  function logEvent(what) {
    return function() {
      eLazy.event(what);
    };
  };
  // helper to create a callback that logs the value passed to the callback
  //  using namedValue.  Strictly speaking, we don't need to provide the name
  //  because the testing framework enforces sequencing, I'm just trying to
  //  make the logs perhaps a bit more readable.
  function logNamedValue(name) {
    return function(val) {
      eLazy.namedValue(name, val);
    };
  };

  T.group('setup');
  T.action(eLazy, 'create connection', function() {
    conn = $gendb.makeTestDBConnection('reorderable');
  });
  T.action(eLazy, 'define schema', function() {
    eLazy.expect_event('schema defined');

    when(conn.defineSchema(dbSchema), logEvent('schema defined'), badNews);
  });


  // - empties
  T.group('empty index scan');
  T.check(eLazy, 'empty numeric index scan returns empty list', function() {
    eLazy.expect_namedValue('empty index', []);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('empty index'), badNews);
  });
  T.check(eLazy, 'empty string index scan returns empty list', function() {
    eLazy.expect_namedValue('empty index', []);
    when(conn.scanStringIndex(TBL_HUMANS, IDX_NAME, '', 1),
         logNamedValue('empty index'), badNews);
  });

  // - updates work
  T.group('update clobbers: number');
  T.action(eLazy, 'insert A=1', function() {
    eLazy.expect_event('did put A=1');
    when(conn.updateIndexValue(TBL_HUMANS, IDX_AGE, '', 'A', 1),
         logEvent('did put A=1'), badNews);
  });
  T.check(eLazy, 'check A=1', function() {
    eLazy.expect_namedValue('scan post A=1', ['A', 1]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('scan post A=1'), badNews);
  });
  T.action(eLazy, 'update A=2', function() {
    eLazy.expect_event('did put A=2');
    when(conn.updateIndexValue(TBL_HUMANS, IDX_AGE, '', 'A', 2),
         logEvent('did put A=2'), badNews);
  });
  T.check(eLazy, 'check A=2', function() {
    eLazy.expect_namedValue('scan post A=2', ['A', 2]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', 1),
         logNamedValue('scan post A=2'), badNews);
  });
  T.action(eLazy, 'update A=0', function() {
    eLazy.expect_event('did put A=0');
    when(conn.updateIndexValue(TBL_HUMANS, IDX_AGE, '', 'A', 0),
         logEvent('did put A=0'), badNews);
  });
  T.check(eLazy, 'check A=0', function() {
    eLazy.expect_namedValue('scan post A=0', ['A', 0]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('scan post A=0'), badNews);
  });

  T.group('update clobbers: string');
  T.action(eLazy, 'insert A=foo', function() {
    eLazy.expect_event('did put A=foo');
    when(conn.updateStringIndexValue(TBL_HUMANS, IDX_NAME, '', 'A', 'foo'),
         logEvent('did put A=foo'), badNews);
  });
  T.check(eLazy, 'check A=foo', function() {
    eLazy.expect_namedValue('scan post A=foo', ['A', 'foo']);
    when(conn.scanStringIndex(TBL_HUMANS, IDX_NAME, '', 1),
         logNamedValue('scan post A=foo'), badNews);
  });
  T.action(eLazy, 'update A=bar', function() {
    eLazy.expect_event('did put A=bar');
    when(conn.updateStringIndexValue(TBL_HUMANS, IDX_NAME, '', 'A', 'bar'),
         logEvent('did put A=bar'), badNews);
  });
  T.check(eLazy, 'check A=bar', function() {
    eLazy.expect_namedValue('scan post A=bar', ['A', 'bar']);
    when(conn.scanStringIndex(TBL_HUMANS, IDX_NAME, '', 1),
         logNamedValue('scan post A=bar'), badNews);
  });

  // - maximize works
  T.group('maximize maximizes');
  T.action(eLazy, 'max A=5', function() {
    eLazy.expect_event('did max A=5');
    when(conn.maximizeIndexValue(TBL_HUMANS, IDX_AGE, '', 'A', 5),
         logEvent('did max A=5'), badNews);
  });
  T.check(eLazy, 'check A=5', function() {
    eLazy.expect_namedValue('scan post A=max~5', ['A', 5]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('scan post A=max~5'), badNews);
  });
  T.action(eLazy, 'max A=2', function() {
    eLazy.expect_event('did max A=2');
    when(conn.maximizeIndexValue(TBL_HUMANS, IDX_AGE, '', 'A', 2),
         logEvent('did max A=2'), badNews);
  });
  T.check(eLazy, 'check A=5', function() {
    eLazy.expect_namedValue('scan post A=max~2', ['A', 5]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('scan post A=max~2'), badNews);
  });
  // XXX should perform a maximize that creates a non-existent index value...

  // - ordering is right...
  T.group('populated index scan: number');
  T.action(eLazy, 'update B=3', function() {
    eLazy.expect_event('did put B=3');
    when(conn.updateIndexValue(TBL_HUMANS, IDX_AGE, '', 'B', 3),
         logEvent('did put B=3'), badNews);
  });
  T.check(eLazy, 'check A,B ordering', function() {
    eLazy.expect_namedValue('ordering', ['A', 5, 'B', 3]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('ordering'), badNews);
  });
  T.action(eLazy, 'update C=0', function() {
    eLazy.expect_event('did put C=0');
    when(conn.updateIndexValue(TBL_HUMANS, IDX_AGE, '', 'C', 0),
         logEvent('did put C=0'), badNews);
  });
  T.check(eLazy, 'check A,B,C ordering', function() {
    eLazy.expect_namedValue('ordering', ['A', 5, 'B', 3, 'C', 0]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('ordering'), badNews);
  });

  T.group('populated index scan: string');
  T.check(eLazy, 'update B=car', function() {
    eLazy.expect_event('did put B=car');
    when(conn.updateStringIndexValue(TBL_HUMANS, IDX_NAME, '', 'B', 'car'),
         logEvent('did put B=car'), badNews);
  });
  T.check(eLazy, 'check A,B ordering', function() {
    eLazy.expect_namedValue('string ordering', ['A', 'bar', 'B', 'car']);
    when(conn.scanStringIndex(TBL_HUMANS, IDX_NAME, '', 1),
         logNamedValue('string ordering'), badNews);
  });

  // - ordering can change...
  T.group('index orderings can change: number');
  T.action(eLazy, 'max C=7', function() {
    eLazy.expect_event('did max C=7');
    when(conn.maximizeIndexValue(TBL_HUMANS, IDX_AGE, '', 'C', 7),
         logEvent('did max C=7'), badNews);
  });
  T.check(eLazy, 'check C,A,B ordering', function() {
    eLazy.expect_namedValue('ordering', ['C', 7, 'A', 5, 'B', 3]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('ordering'), badNews);
  });


  T.group('index orderings can change: string');
  T.check(eLazy, 'update B=aar', function() {
    eLazy.expect_event('did put B=aar');
    when(conn.updateStringIndexValue(TBL_HUMANS, IDX_NAME, '', 'B', 'aar'),
         logEvent('did put B=aar'), badNews);
  });
  T.check(eLazy, 'check B,A ordering', function() {
    eLazy.expect_namedValue('string ordering', ['B', 'aar', 'A', 'bar']);
    when(conn.scanStringIndex(TBL_HUMANS, IDX_NAME, '', 1),
         logNamedValue('string ordering'), badNews);
  });

  // - namespacing (by thing being empty)
  T.group('parameters properly namespace');
  T.check(eLazy, 'empty numeric index scan returns empty list', function() {
    eLazy.expect_namedValue('empty index', []);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, 'blah', -1),
         logNamedValue('empty index'), badNews);
  });
  T.check(eLazy, 'empty string index scan returns empty list', function() {
    eLazy.expect_namedValue('empty index', []);
    when(conn.scanStringIndex(TBL_HUMANS, IDX_NAME, 'blah', 1),
         logNamedValue('empty index'), badNews);
  });

  // - batch updates (numeric)
  T.group('batch update: number');
  T.action(eLazy, 'B=11, A=10, C=9', function() {
    eLazy.expect_event('did batch update');
    var updates = [
      [IDX_AGE, '', 'B', 11],
      [IDX_AGE, '', 'A', 10],
      [IDX_AGE, '', 'C', 9],
    ];
    when(conn.updateMultipleIndexValues(TBL_HUMANS, updates),
         logEvent('did batch update'), badNews);
  });
  T.check(eLazy, 'check B,A,C ordering', function() {
    eLazy.expect_namedValue('ordering', ['B', 11, 'A', 10, 'C', 9]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('ordering'), badNews);
  });

  // - batch maximizations (numeric)
  T.group('batch update: number');
  T.action(eLazy, 'B=max(1,?), A=max(12,?), C=max(10,?)', function() {
    var updates = [
      [IDX_AGE, '', 'B', 1],
      [IDX_AGE, '', 'A', 12],
      [IDX_AGE, '', 'C', 10],
      [IDX_AGE, '', 'X', 1], // this is a creation here!
    ];
    var expectedMaxes = [
      [IDX_AGE, '', 'B', 11], // this one needs to get updated
      [IDX_AGE, '', 'A', 12],
      [IDX_AGE, '', 'C', 10],
      [IDX_AGE, '', 'X', 1],
    ];
    eLazy.expect_namedValue('batch maximized', expectedMaxes);
    when(conn.maximizeMultipleIndexValues(TBL_HUMANS, updates),
         logNamedValue('batch maximized'), badNews);
  });
  T.check(eLazy, 'check A,B,C,X ordering', function() {
    eLazy.expect_namedValue('ordering', ['A', 12, 'B', 11, 'C', 10, 'X', 1]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('ordering'), badNews);
  });

  // - index deletion
  T.group('batch delete: number');
  T.action(eLazy, 'del B,X', function() {
    eLazy.expect_event('did batch deletion');
    // note that we do not need to provide the previous index value currently
    var nukes = [
      [IDX_AGE, '', 'B', null],
      [IDX_AGE, '', 'X', null],
    ];
    when(conn.deleteMultipleIndexValues(TBL_HUMANS, nukes),
         logEvent('did batch deletion'), badNews);
  });
  T.check(eLazy, 'check A,C ordering', function() {
    eLazy.expect_namedValue('ordering', ['A', 12, 'C', 10]);
    when(conn.scanIndex(TBL_HUMANS, IDX_AGE, '', -1),
         logNamedValue('ordering'), badNews);
  });

  // - cleanup
  T.group('cleanup');
  T.cleanup(eLazy, 'cleanup', function() {
    $gendb.cleanupTestDBConnection(conn);
  });
});

TD.commonCase('queue model', function(T) {
  // although the database connection has a logger, they're not really useful
  //  for correctness, just for knowing what's happening, so we create a lazy
  //  person's logger for the unit test.
  var eLazy = T.lazyLogger('db'), conn;

  // use a common rejection handler for everything.
  function badNews(err) {
    eLazy.error(err);
  }
  // helper to create a callback handler
  function logEvent(what) {
    return function() {
      eLazy.event(what);
    };
  };
  // helper to create a callback that logs the value passed to the callback
  //  using namedValue.  Strictly speaking, we don't need to provide the name
  //  because the testing framework enforces sequencing, I'm just trying to
  //  make the logs perhaps a bit more readable.
  function logNamedValue(name) {
    return function(val) {
      eLazy.namedValue(name, val);
    };
  };

  T.group('setup');
  T.action(eLazy, 'create connection', function() {
    conn = $gendb.makeTestDBConnection('queue');
  });
  T.action(eLazy, 'define schema', function() {
    eLazy.expect_event('schema defined');

    when(conn.defineSchema(dbSchema), logEvent('schema defined'), badNews);
  });

  T.group('basics: append 1; peek 1; consume 1; peek 0');
  T.action(eLazy, 'put A', function() {
    eLazy.expect_event('put A');
    when(conn.queueAppend(TBQ_TODO, 'letters', [{say: 'A'}]),
         logEvent('put A'), badNews);
  });
  T.action(eLazy, 'peek A', function() {
    eLazy.expect_namedValue('peek A', [{say: 'A'}]);
    when(conn.queuePeek(TBQ_TODO, 'letters', 1),
         logNamedValue('peek A'), badNews);
  });
  T.action(eLazy, 'peek A again, still there', function() {
    eLazy.expect_namedValue('peek A', [{say: 'A'}]);
    when(conn.queuePeek(TBQ_TODO, 'letters', 1),
         logNamedValue('peek A'), badNews);
  });
  T.action(eLazy, 'consume A', function() {
    eLazy.expect_event('consume A');
    when(conn.queueConsume(TBQ_TODO, 'letters', 1),
         logEvent('consume A'), badNews);
  });
  T.action(eLazy, 'peek now empty', function() {
    eLazy.expect_namedValue('peek empty', []);
    when(conn.queuePeek(TBQ_TODO, 'letters', 1),
         logNamedValue('peek empty'), badNews);
  });

  T.group('greater depth, check consumeAndPeek too');
  T.action(eLazy, 'put B, C', function() {
    eLazy.expect_event('put B, C');
    when(conn.queueAppend(TBQ_TODO, 'letters', [{say: 'B'}, {say: 'C'}]),
         logEvent('put B, C'), badNews);
  });
  T.action(eLazy, 'peek B', function() {
    eLazy.expect_namedValue('peek B', [{say: 'B'}]);
    when(conn.queuePeek(TBQ_TODO, 'letters', 1),
         logNamedValue('peek B'), badNews);
  });
  T.action(eLazy, 'put D, E', function() {
    eLazy.expect_event('put D, E');
    when(conn.queueAppend(TBQ_TODO, 'letters', [{say: 'D'}, {say: 'E'}]),
         logEvent('put D, E'), badNews);
  });
  T.action(eLazy, 'consume B and peek C', function() {
    eLazy.expect_namedValue('consumeAndPeek', [{say: 'C'}]);
    when(conn.queueConsumeAndPeek(TBQ_TODO, 'letters', 1, 1),
         logNamedValue('consumeAndPeek'), badNews);
  });
  T.action(eLazy, 'consume C,D and peek E', function() {
    eLazy.expect_namedValue('consumeAndPeek', [{say: 'E'}]);
    when(conn.queueConsumeAndPeek(TBQ_TODO, 'letters', 2, 1),
         logNamedValue('consumeAndPeek'), badNews);
  });

  T.group('separate queues are separate');
  T.action(eLazy, 'put 1, 2', function() {
    eLazy.expect_event('put 1, 2');
    when(conn.queueAppend(TBQ_TODO, 'numbers', [{say: 1}, {say: 2}]),
         logEvent('put 1, 2'), badNews);
  });
  T.action(eLazy, 'peek E', function() {
    eLazy.expect_namedValue('peek E', [{say: 'E'}]);
    when(conn.queuePeek(TBQ_TODO, 'letters', 1),
         logNamedValue('peek E'), badNews);
  });
  T.action(eLazy, 'peek 1', function() {
    eLazy.expect_namedValue('peek 1', [{say: 1}]);
    when(conn.queuePeek(TBQ_TODO, 'numbers', 1),
         logNamedValue('peek 1'), badNews);
  });
  T.action(eLazy, 'consume 1', function() {
    eLazy.expect_event('consume 1');
    when(conn.queueConsume(TBQ_TODO, 'numbers', 1),
         logEvent('consume 1'), badNews);
  });
  T.action(eLazy, 'peek E', function() {
    eLazy.expect_namedValue('peek E', [{say: 'E'}]);
    when(conn.queuePeek(TBQ_TODO, 'letters', 1),
         logNamedValue('peek E'), badNews);
  });
  T.action(eLazy, 'peek 2', function() {
    eLazy.expect_namedValue('peek 2', [{say: 2}]);
    when(conn.queuePeek(TBQ_TODO, 'numbers', 1),
         logNamedValue('peek 2'), badNews);
  });


  T.group('cleanup');
  T.cleanup(eLazy, 'cleanup', function() {
    $gendb.cleanupTestDBConnection(conn);
  });
});

}); // end define
