
-- 20. USER REPORTS
CREATE TABLE public.reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reported_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view their own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.reports FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 21. MESSAGE REACTIONS
CREATE TABLE public.message_reactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view reactions" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own reactions" ON public.message_reactions FOR ALL USING (auth.uid() = user_id);

-- 22. ROOMS (For Group Chats)
CREATE TABLE public.rooms (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT,
    type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.room_members (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(room_id, user_id)
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their rooms" ON public.rooms FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = id AND user_id = auth.uid())
);

ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view room members" ON public.room_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members rm WHERE rm.room_id = room_id AND rm.user_id = auth.uid())
);

-- 23. MESSAGE ENHANCEMENTS (Add columns to existing table)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id);

-- 24. MESSAGE DELETION POLICY
CREATE POLICY "Users can soft delete their own messages" ON public.messages FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
