-- Assets: distributable, versioned capability packages. Public assets require
-- a license; datasets require rights metadata before public publication
-- (enforced in the application publication gate).
CREATE TABLE assets (
  id text NOT NULL,
  version text NOT NULL,
  kind text NOT NULL CHECK (
    kind IN ('island', 'process', 'skill', 'template', 'knowledge_package', 'evaluation_pack', 'dataset')
  ),
  name text NOT NULL,
  description text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  owner jsonb NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'workspace', 'public')),
  license text NOT NULL,
  content_ref jsonb NOT NULL,
  rights jsonb,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, version)
);

CREATE INDEX assets_public_idx ON assets (visibility) WHERE visibility = 'public';
CREATE INDEX assets_owner_idx ON assets ((owner->>'id'));
