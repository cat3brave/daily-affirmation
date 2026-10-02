-- 手動の任意監査。全文一括実行しない。手順書の前提を満たすblockだけ選ぶ。
-- bucket IDは構成識別子。object名・path・所有ID・本文・metadataは返さない。

-- S1: bucketsのid/public列と全件可視性を確認した場合のみ。
SELECT id AS bucket_id, public AS is_public FROM storage.buckets ORDER BY id;

-- S2: objects.owner_id がtext/varchar、bucket_idが存在する場合のみ。
-- auth.users.idを比較に使うが、ID・メール・token等は出力しない。
SELECT o.bucket_id, count(*) AS object_count,
       count(*) FILTER (WHERE o.owner_id IS NULL OR o.owner_id='') AS no_owner_count,
       count(*) FILTER (WHERE u.id IS NOT NULL) AS matching_auth_owner_count,
       count(*) FILTER (WHERE o.owner_id IS NOT NULL AND o.owner_id<>'' AND u.id IS NULL) AS unmatched_owner_count
FROM storage.objects o
LEFT JOIN auth.users u ON u.id::text=o.owner_id
GROUP BY o.bucket_id ORDER BY o.bucket_id;

-- S3: legacy objects.owner がuuidの場合のみ。S2の代替、両者の意味は自動で同一視しない。
SELECT o.bucket_id, count(*) AS object_count,
       count(*) FILTER (WHERE o.owner IS NULL) AS no_owner_count,
       count(*) FILTER (WHERE u.id IS NOT NULL) AS matching_auth_owner_count,
       count(*) FILTER (WHERE o.owner IS NOT NULL AND u.id IS NULL) AS unmatched_owner_count
FROM storage.objects o
LEFT JOIN auth.users u ON u.id=o.owner
GROUP BY o.bucket_id ORDER BY o.bucket_id;
