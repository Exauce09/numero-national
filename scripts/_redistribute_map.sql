WITH src AS (
  SELECT DISTINCT ON (h.id)
    h.id,
    COALESCE(r.payload->>'province_code', '') AS pcode,
    lower(replace(coalesce(r.payload->>'province_origine', h.address_line, ''), ' ', '-')) AS pname,
    h.local_id
  FROM recensement.households h
  LEFT JOIN recensement.census_records r ON r.household_id = h.id
  ORDER BY h.id, r.promoted_at DESC NULLS LAST
),
mapped AS (
  SELECT id, local_id,
    CASE
      WHEN pcode IN ('01') OR pname LIKE '%kinshasa%' THEN -4.3276
      WHEN pcode IN ('03') OR pname LIKE '%kwango%' THEN -5.0410
      WHEN pcode IN ('04') OR pname LIKE '%kongo%' THEN -5.8160
      WHEN pcode IN ('06') OR pname LIKE '%kasai%' AND pname NOT LIKE '%central%' AND pname NOT LIKE '%oriental%' THEN -5.9000
      WHEN pcode IN ('07') OR pname LIKE '%sankuru%' THEN -2.1500
      WHEN pcode IN ('08') OR pname LIKE '%central%' THEN -5.8960
      WHEN pcode IN ('09') OR (pname LIKE '%lomami%' AND pname NOT LIKE '%haut%') THEN -6.1333
      WHEN pcode IN ('10') OR pname LIKE '%haut-katanga%' OR pname LIKE '%katanga%' THEN -11.6647
      WHEN pcode IN ('11') OR pname LIKE '%lualaba%' THEN -10.7167
      WHEN pcode IN ('12') OR pname LIKE '%haut-lomami%' THEN -8.7333
      WHEN pcode IN ('13') OR pname LIKE '%sud-kivu%' THEN -2.5000
      WHEN pcode IN ('14') OR pname LIKE '%maniema%' THEN -2.9500
      WHEN pcode IN ('15') OR pname LIKE '%nord-kivu%' THEN -1.6780
      WHEN pcode IN ('16') OR pname LIKE '%nord-ubangi%' OR pname LIKE '%ubangi%' THEN 4.2833
      ELSE NULL
    END AS lat0,
    CASE
      WHEN pcode IN ('01') OR pname LIKE '%kinshasa%' THEN 15.3136
      WHEN pcode IN ('03') OR pname LIKE '%kwango%' THEN 18.8160
      WHEN pcode IN ('04') OR pname LIKE '%kongo%' THEN 13.4500
      WHEN pcode IN ('06') OR pname LIKE '%kasai%' AND pname NOT LIKE '%central%' AND pname NOT LIKE '%oriental%' THEN 22.4000
      WHEN pcode IN ('07') OR pname LIKE '%sankuru%' THEN 22.4667
      WHEN pcode IN ('08') OR pname LIKE '%central%' THEN 22.4170
      WHEN pcode IN ('09') OR (pname LIKE '%lomami%' AND pname NOT LIKE '%haut%') THEN 24.4833
      WHEN pcode IN ('10') OR pname LIKE '%haut-katanga%' OR pname LIKE '%katanga%' THEN 27.4794
      WHEN pcode IN ('11') OR pname LIKE '%lualaba%' THEN 25.4667
      WHEN pcode IN ('12') OR pname LIKE '%haut-lomami%' THEN 24.9833
      WHEN pcode IN ('13') OR pname LIKE '%sud-kivu%' THEN 28.8667
      WHEN pcode IN ('14') OR pname LIKE '%maniema%' THEN 25.9500
      WHEN pcode IN ('15') OR pname LIKE '%nord-kivu%' THEN 29.2220
      WHEN pcode IN ('16') OR pname LIKE '%nord-ubangi%' OR pname LIKE '%ubangi%' THEN 21.0167
      ELSE NULL
    END AS lng0
  FROM src
)
UPDATE recensement.households h
SET
  latitude = m.lat0 + ((get_byte(decode(md5(coalesce(m.local_id, m.id::text)), 'hex'), 0)::int % 100) - 50) / 900.0,
  longitude = m.lng0 + ((get_byte(decode(md5(coalesce(m.local_id, m.id::text)), 'hex'), 1)::int % 100) - 50) / 900.0,
  address_source = COALESCE(h.address_source, 'manual')
FROM mapped m
WHERE h.id = m.id AND m.lat0 IS NOT NULL;
