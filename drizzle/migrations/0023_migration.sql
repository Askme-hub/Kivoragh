DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
DELETE FROM public.notifications n
WHERE n.link = '/messages'
  AND EXISTS (SELECT 1 FROM public.notifications o WHERE o.user_id = n.user_id AND o.id <> n.id
    AND o.link LIKE '%messages?c=%' AND abs(extract(epoch FROM (o.created_at - n.created_at))) < 5);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;