CREATE TABLE public.client_page_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    public_token text NOT NULL,
    shared_by_user_id uuid,
    shared_by_name text,
    shared_by_email text NOT NULL,
    shared_with_email public.citext NOT NULL,
    shared_with_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.client_page_shares IS 'Recipient-specific records for project client-page shares.';
COMMENT ON COLUMN public.client_page_shares.public_token IS 'The active client-page token at the time the project was shared.';
COMMENT ON COLUMN public.client_page_shares.shared_by_name IS 'Snapshot of the sharer name when the share was last sent.';
COMMENT ON COLUMN public.client_page_shares.shared_by_email IS 'Snapshot of the sharer email when the share was last sent.';

ALTER TABLE ONLY public.client_page_shares
    ADD CONSTRAINT client_page_shares_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_page_shares
    ADD CONSTRAINT client_page_shares_project_recipient_key UNIQUE (project_id, shared_with_email);

ALTER TABLE ONLY public.client_page_shares
    ADD CONSTRAINT client_page_shares_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_page_shares
    ADD CONSTRAINT client_page_shares_shared_by_user_id_fkey FOREIGN KEY (shared_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.client_page_shares
    ADD CONSTRAINT client_page_shares_shared_with_user_id_fkey FOREIGN KEY (shared_with_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_client_page_shares_shared_with_email
    ON public.client_page_shares USING btree (shared_with_email);

CREATE INDEX idx_client_page_shares_shared_with_user_id
    ON public.client_page_shares USING btree (shared_with_user_id);

CREATE TRIGGER client_page_shares_set_updated_at
BEFORE UPDATE ON public.client_page_shares
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_page_shares ENABLE ROW LEVEL SECURITY;
