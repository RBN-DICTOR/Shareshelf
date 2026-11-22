-- ============================================================================
-- ShareShelf Neighbor Chat Migration (borrow_messages)
-- Run this in your Supabase SQL Editor to enable cross-device Realtime chat.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.borrow_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_key text NOT NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.borrow_requests(id) ON DELETE SET NULL,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_borrow_messages_thread_created
  ON public.borrow_messages (thread_key, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_borrow_messages_sender_created
  ON public.borrow_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_borrow_messages_recipient_unread
  ON public.borrow_messages (recipient_id, is_read, created_at DESC);

ALTER TABLE public.borrow_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their messages" ON public.borrow_messages;
CREATE POLICY "Participants can view their messages"
  ON public.borrow_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Authenticated users can send messages as themselves" ON public.borrow_messages;
CREATE POLICY "Authenticated users can send messages as themselves"
  ON public.borrow_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);

DROP POLICY IF EXISTS "Recipients can mark messages read" ON public.borrow_messages;
CREATE POLICY "Recipients can mark messages read"
  ON public.borrow_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Notify recipient when a new neighbor message arrives
CREATE OR REPLACE FUNCTION public.notify_on_borrow_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  item_name text;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  IF NEW.item_id IS NOT NULL THEN
    SELECT name INTO item_name FROM public.items WHERE id = NEW.item_id;
  END IF;

  INSERT INTO public.notifications (user_id, message, is_read)
  VALUES (
    NEW.recipient_id,
    CASE
      WHEN item_name IS NOT NULL THEN
        format('New message from %s about %s', COALESCE(sender_name, 'a neighbor'), item_name)
      ELSE
        format('New message from %s', COALESCE(sender_name, 'a neighbor'))
    END,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_borrow_message ON public.borrow_messages;
CREATE TRIGGER trg_notify_borrow_message
  AFTER INSERT ON public.borrow_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_borrow_message();

-- Add to Supabase Realtime publication safely
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.borrow_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
