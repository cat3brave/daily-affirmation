-- 手動監査専用。migration/schema setupから呼ばない。
-- docs/account-deletion-db-audit.mdを先に読む。各番号を別の実行単位にする。
-- 全文はSELECTのみ。利用者の行・関数本文・token・メールは返さない。

-- 01: バージョンと監査ロール（接続文字列は取得しない）
SELECT current_setting('server_version_num') AS server_version_num,
       current_user AS audit_role, r.rolsuper, r.rolbypassrls,
       current_setting('transaction_read_only') AS transaction_read_only
FROM pg_catalog.pg_roles r WHERE r.rolname = current_user;

-- 02: 必須relationの存在。missingは担当者の可視性確認前には不在確定でない。
WITH expected(schema_name, table_name) AS (
  VALUES ('auth','users'), ('public','todos'), ('public','bloom_logs'),
         ('public','three_good_things'), ('public','favorite_affirmations'),
         ('storage','buckets'), ('storage','objects')
)
SELECT e.*, c.oid IS NOT NULL AS catalog_visible, c.relkind,
       c.relrowsecurity, c.relforcerowsecurity,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner_role
FROM expected e
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = e.schema_name
LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = e.table_name
ORDER BY e.schema_name, e.table_name;

-- 03: 全FK。auth.usersへの直接参照と、追加テーブルを経る連鎖を辿る。
-- 定義文字列を出さず列の対応をordinal順に出す（CHECK内のliteralも非出力）。
SELECT sn.nspname AS source_schema, s.relname AS source_table, k.conname,
       ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY x(num, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num
             ORDER BY x.ord) AS source_columns,
       tn.nspname AS target_schema, t.relname AS target_table,
       ARRAY(SELECT a.attname FROM unnest(k.confkey) WITH ORDINALITY x(num, ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num
             ORDER BY x.ord) AS target_columns,
       CASE k.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_delete,
       k.confupdtype AS on_update_code, k.confmatchtype AS match_code,
       k.convalidated, k.condeferrable, k.condeferred
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class s ON s.oid=k.conrelid
JOIN pg_catalog.pg_namespace sn ON sn.oid=s.relnamespace
JOIN pg_catalog.pg_class t ON t.oid=k.confrelid
JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace
WHERE k.contype='f'
ORDER BY target_schema, target_table, source_schema, source_table, k.conname;

-- 04: 全非system relationと列。名前が異なる所有列・ビューも人が棚卸しする。
-- default値そのものは取得せずauth.uid()との完全一致だけ確認。
SELECT n.nspname AS schema_name, c.relname, c.relkind,
       a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod) AS column_type,
       a.attnotnull, d.oid IS NOT NULL AS has_default,
       CASE WHEN a.attname='user_id' AND d.oid IS NOT NULL
         THEN pg_catalog.pg_get_expr(d.adbin,d.adrelid)='auth.uid()' END AS default_is_auth_uid,
       c.relrowsecurity, c.relforcerowsecurity, pg_catalog.pg_get_userbyid(c.relowner) AS owner_role
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,c.relname,a.attnum;

-- 05: 制約とindex。unique indexはpg_constraintにないことがある。
SELECT n.nspname AS schema_name,c.relname,k.conname,k.contype,
       ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY x(num,ord)
             JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=x.num
             ORDER BY x.ord) AS columns,
       k.convalidated,k.condeferrable,k.condeferred
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,c.relname,k.conname;

SELECT n.nspname AS schema_name,c.relname,i.relname AS index_name,
       x.indisprimary,x.indisunique,x.indisvalid,x.indisready,
       ARRAY(SELECT a.attname FROM unnest(x.indkey) WITH ORDINALITY z(num,ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=z.num
             ORDER BY z.ord) AS columns,
       x.indexprs IS NOT NULL AS has_expression, x.indpred IS NOT NULL AS is_partial
FROM pg_catalog.pg_index x
JOIN pg_catalog.pg_class c ON c.oid=x.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,c.relname,i.relname;

-- 06: 内部FK triggerも含める。引数・WHEN・関数本文は秘密を含み得るので非出力。
SELECT n.nspname AS schema_name,c.relname,t.tgname,t.tgenabled,t.tgisinternal,
       t.tgtype AS event_bits,t.tgconstraint,
       fn.nspname AS function_schema,p.proname,p.oid AS function_oid,
       p.prosecdef AS security_definer
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
JOIN pg_catalog.pg_namespace fn ON fn.oid=p.pronamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,c.relname,t.tgname;

-- 07: RLS policy inventory。式は秘密literal混入を避け非出力。
-- auth.uid/user_idの出現は安全性の証明ではない。定義の別途レビューが必要。
SELECT n.nspname AS schema_name,c.relname,p.polname,p.polcmd,p.polpermissive,
       ARRAY(SELECT CASE WHEN x.role_oid=0 THEN 'PUBLIC' ELSE r.rolname END
             FROM unnest(p.polroles) x(role_oid)
             LEFT JOIN pg_catalog.pg_roles r ON r.oid=x.role_oid) AS roles,
       p.polqual IS NOT NULL AS has_using,p.polwithcheck IS NOT NULL AS has_with_check,
       COALESCE(pg_catalog.pg_get_expr(p.polqual,p.polrelid)='(auth.uid() = user_id)',false) AS using_is_exact_owner,
       COALESCE(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)='(auth.uid() = user_id)',false) AS check_is_exact_owner,
       COALESCE(pg_catalog.pg_get_expr(p.polqual,p.polrelid) LIKE '%auth.uid()%user_id%',false) AS using_mentions_owner,
       COALESCE(pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) LIKE '%auth.uid()%user_id%',false) AS check_mentions_owner
FROM pg_catalog.pg_policy p
JOIN pg_catalog.pg_class c ON c.oid=p.polrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
ORDER BY n.nspname,c.relname,p.polname;

-- 08: 全ロールの実効relation/column権限。PUBLIC・継承もhas_*で反映。
SELECT n.nspname AS schema_name,c.relname,r.rolname,r.rolsuper,r.rolbypassrls,
       pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
       pg_catalog.has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
       pg_catalog.has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
       pg_catalog.has_table_privilege(r.oid,c.oid,'UPDATE') AS can_update,
       pg_catalog.has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete,
       pg_catalog.has_table_privilege(r.oid,c.oid,'TRUNCATE') AS can_truncate,
       pg_catalog.has_any_column_privilege(r.oid,c.oid,'SELECT') AS any_column_select,
       pg_catalog.has_any_column_privilege(r.oid,c.oid,'INSERT') AS any_column_insert,
       pg_catalog.has_any_column_privilege(r.oid,c.oid,'UPDATE') AS any_column_update
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_catalog.pg_roles r
WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,c.relname,r.rolname;

SELECT member_role.rolname AS member_role,parent_role.rolname AS granted_role,m.admin_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles member_role ON member_role.oid=m.member
JOIN pg_catalog.pg_roles parent_role ON parent_role.oid=m.roleid
ORDER BY member_role.rolname,parent_role.rolname;

-- 09: 関数/RPC候補を全非system schemaから取得。呼び出さず本文・proconfigを返さない。
SELECT n.nspname AS schema_name,p.proname,p.oid AS function_oid,
       p.proargtypes AS argument_type_oids,p.prorettype AS return_type_oid,
       l.lanname,p.prosecdef AS security_definer,p.provolatile,
       EXISTS(SELECT 1 FROM unnest(p.proconfig) v(setting)
              WHERE v.setting LIKE 'search_path=%') AS has_search_path_setting,
       r.rolname,pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE') AS can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid=p.prolang
CROSS JOIN pg_catalog.pg_roles r
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,p.proname,p.oid,r.rolname;

-- 10: カタログに記録されたrelation依存（dynamic SQL・文字列の参照は網羅しない）。
SELECT n.nspname AS referenced_schema,c.relname AS referenced_relation,
       d.classid::regclass AS dependent_catalog,d.objid,d.objsubid,d.deptype
FROM pg_catalog.pg_depend d
JOIN pg_catalog.pg_class c ON d.refclassid='pg_catalog.pg_class'::regclass AND c.oid=d.refobjid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'
ORDER BY n.nspname,c.relname,d.classid,d.objid;
