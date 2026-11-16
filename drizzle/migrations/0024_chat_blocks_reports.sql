CREATE TABLE public.chat_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.chat_blocks TO authenticated;
GRANT ALL ON public.chat_blocks TO service_role;
ALTER TABLE public.chat_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see blocks involving me" ON public.chat_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "create own block" ON public.chat_blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);
CREATE POLICY "remove own block" ON public.chat_blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

CREATE TABLE public.chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_reports TO authenticated;
GRANT ALL ON public.chat_reports TO service_role;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter or admin reads" ON public.chat_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "participant reports" ON public.chat_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND public.is_conversation_participant(conversation_id) AND length(reason) <= 80 AND coalesce(length(details),0) <= 1000);
CREATE POLICY "admin updates reports" ON public.chat_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_blocked_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE other uuid;
BEGIN
  SELECT CASE WHEN c.customer_id = NEW.sender_id THEN c.seller_id ELSE c.customer_id END INTO other
  FROM public.conversations c WHERE c.id = NEW.conversation_id;
  IF EXISTS (SELECT 1 FROM public.chat_blocks b WHERE (b.blocker_id = NEW.sender_id AND b.blocked_id = other) OR (b.blocker_id = other AND b.blocked_id = NEW.sender_id)) THEN
    RAISE EXCEPTION 'Messaging is blocked in this chat';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_blocked_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_blocked_message BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.guard_blocked_message();