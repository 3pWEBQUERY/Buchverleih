-- Startregion (PRD 1, Annahmen): Stadt Zürich und Zürcher Unterland.
-- Koordinaten sind Ortsmittelpunkte, gerundet auf drei Nachkommastellen.

insert into regions (id, name, enabled) values
  ('zh-stadt', 'Stadt Zürich', true),
  ('zh-unterland', 'Zürcher Unterland', true),
  ('zh-agglo', 'Agglomeration Zürich', false),
  ('winterthur', 'Winterthur', false)
on conflict (id) do nothing;

insert into postal_codes (plz, municipality, region_id, lat, lng) values
  ('8001', 'Zürich', 'zh-stadt', 47.372, 8.541),
  ('8002', 'Zürich', 'zh-stadt', 47.362, 8.530),
  ('8003', 'Zürich', 'zh-stadt', 47.370, 8.515),
  ('8004', 'Zürich', 'zh-stadt', 47.378, 8.520),
  ('8005', 'Zürich', 'zh-stadt', 47.387, 8.520),
  ('8006', 'Zürich', 'zh-stadt', 47.388, 8.545),
  ('8008', 'Zürich', 'zh-stadt', 47.356, 8.556),
  ('8032', 'Zürich', 'zh-stadt', 47.370, 8.561),
  ('8037', 'Zürich', 'zh-stadt', 47.395, 8.525),
  ('8038', 'Zürich', 'zh-stadt', 47.340, 8.531),
  ('8041', 'Zürich', 'zh-stadt', 47.330, 8.512),
  ('8044', 'Zürich', 'zh-stadt', 47.380, 8.565),
  ('8045', 'Zürich', 'zh-stadt', 47.360, 8.510),
  ('8046', 'Zürich', 'zh-stadt', 47.420, 8.510),
  ('8047', 'Zürich', 'zh-stadt', 47.375, 8.490),
  ('8048', 'Zürich', 'zh-stadt', 47.388, 8.485),
  ('8049', 'Zürich', 'zh-stadt', 47.402, 8.497),
  ('8050', 'Zürich', 'zh-stadt', 47.411, 8.545),
  ('8051', 'Zürich', 'zh-stadt', 47.405, 8.575),
  ('8052', 'Zürich', 'zh-stadt', 47.421, 8.545),
  ('8053', 'Zürich', 'zh-stadt', 47.360, 8.590),
  ('8055', 'Zürich', 'zh-stadt', 47.362, 8.500),
  ('8057', 'Zürich', 'zh-stadt', 47.400, 8.545),
  ('8064', 'Zürich', 'zh-stadt', 47.390, 8.470),
  ('8105', 'Regensdorf', 'zh-unterland', 47.434, 8.468),
  ('8107', 'Buchs ZH', 'zh-unterland', 47.459, 8.437),
  ('8108', 'Dällikon', 'zh-unterland', 47.440, 8.438),
  ('8112', 'Otelfingen', 'zh-unterland', 47.460, 8.391),
  ('8152', 'Opfikon', 'zh-unterland', 47.430, 8.570),
  ('8153', 'Rümlang', 'zh-unterland', 47.450, 8.530),
  ('8154', 'Oberglatt', 'zh-unterland', 47.475, 8.520),
  ('8155', 'Niederhasli', 'zh-unterland', 47.480, 8.488),
  ('8157', 'Dielsdorf', 'zh-unterland', 47.481, 8.457),
  ('8162', 'Steinmaur', 'zh-unterland', 47.490, 8.450),
  ('8172', 'Niederglatt', 'zh-unterland', 47.490, 8.500),
  ('8180', 'Bülach', 'zh-unterland', 47.522, 8.540),
  ('8181', 'Höri', 'zh-unterland', 47.508, 8.510),
  ('8182', 'Hochfelden', 'zh-unterland', 47.522, 8.515),
  ('8184', 'Bachenbülach', 'zh-unterland', 47.503, 8.540),
  ('8185', 'Winkel', 'zh-unterland', 47.490, 8.555),
  ('8192', 'Glattfelden', 'zh-unterland', 47.560, 8.500),
  ('8193', 'Eglisau', 'zh-unterland', 47.577, 8.521),
  ('8197', 'Rafz', 'zh-unterland', 47.605, 8.543),
  ('8302', 'Kloten', 'zh-unterland', 47.451, 8.585),
  ('8303', 'Bassersdorf', 'zh-unterland', 47.443, 8.628),
  ('8304', 'Wallisellen', 'zh-unterland', 47.415, 8.596),
  ('8309', 'Nürensdorf', 'zh-unterland', 47.448, 8.650),
  ('8424', 'Embrach', 'zh-unterland', 47.505, 8.594),
  ('8600', 'Dübendorf', 'zh-agglo', 47.397, 8.618),
  ('8134', 'Adliswil', 'zh-agglo', 47.310, 8.525),
  ('8800', 'Thalwil', 'zh-agglo', 47.292, 8.563),
  ('8952', 'Schlieren', 'zh-agglo', 47.397, 8.447),
  ('8953', 'Dietikon', 'zh-agglo', 47.404, 8.400),
  ('8702', 'Zollikon', 'zh-agglo', 47.340, 8.575),
  ('8400', 'Winterthur', 'winterthur', 47.500, 8.725)
on conflict (plz) do nothing;

insert into plans (id, name, entitlements) values
  ('standard', 'Standard', '{
     "limits": {
       "0": { "concurrent": 2,  "open_requests": 3 },
       "1": { "concurrent": 5,  "open_requests": 6 },
       "2": { "concurrent": 10, "open_requests": 10 }
     },
     "title_alarms": 20,
     "csv_export": false,
     "shelf_stats": false
   }'::jsonb)
on conflict (id) do nothing;

insert into feature_flags (key, region_id, enabled)
select f.key, r.id, f.enabled
  from regions r
  cross join (values ('swap', true), ('pass_on', true), ('wishlist', true), ('map', false), ('shipping', false)) as f(key, enabled)
on conflict do nothing;
