import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo-friend@climbtracker.test";
const DEMO_NAME = "Demo Crusher";

const DEMO_CLIMBS = [
  {
    grade: "V2",
    grade_modifier: null,
    flashed: true,
    style_tags: ["vertical", "juggy", "static"],
    wall_name: "blue",
    notes: "Fun warm-up flash.",
    status: "completed",
    climbed_on: "2026-03-27"
  },
  {
    grade: "V4",
    grade_modifier: "+",
    flashed: false,
    style_tags: ["overhang", "pinchy", "powerful"],
    wall_name: "purple",
    notes: "Took a few tries but felt strong.",
    status: "completed",
    climbed_on: "2026-03-28"
  },
  {
    grade: "V3",
    grade_modifier: null,
    flashed: true,
    style_tags: ["slab", "technical", "balancey"],
    wall_name: "yellow",
    notes: "Tricky feet, really satisfying.",
    status: "completed",
    climbed_on: "2026-03-28"
  },
  {
    grade: "V5",
    grade_modifier: "-",
    flashed: false,
    style_tags: ["roof", "sloper", "compression"],
    wall_name: "red",
    notes: "Big moves through the roof.",
    status: "completed",
    climbed_on: "2026-03-29"
  },
  {
    grade: "V1",
    grade_modifier: null,
    flashed: true,
    style_tags: ["vertical", "crimpy", "technical"],
    wall_name: "green",
    notes: "Quick flash to end the session.",
    status: "completed",
    climbed_on: "2026-03-29"
  }
] as const;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Demo friend setup needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
      },
      { status: 500 }
    );
  }

  const authorizationHeader = request.headers.get("authorization");
  const accessToken = authorizationHeader?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing auth session for demo friend setup." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const {
    data: { user },
    error: userError
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: userError?.message || "Could not verify the current user." }, { status: 401 });
  }

  const {
    data: existingUsers,
    error: listError
  } = await adminClient.auth.admin.listUsers();

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  let demoUser = existingUsers.users.find((candidate) => candidate.email === DEMO_EMAIL) ?? null;

  if (!demoUser) {
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: {
        display_name: DEMO_NAME
      }
    });

    if (createError || !createdUser.user) {
      return NextResponse.json({ error: createError?.message || "Could not create the demo account." }, { status: 500 });
    }

    demoUser = createdUser.user;
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: demoUser.id,
      display_name: DEMO_NAME,
      device_id: "demo-account"
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: existingFriendship, error: friendshipFetchError } = await adminClient
    .from("friendships")
    .select("id")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${demoUser.id}),and(requester_id.eq.${demoUser.id},addressee_id.eq.${user.id})`)
    .maybeSingle();

  if (friendshipFetchError && friendshipFetchError.code !== "PGRST116") {
    return NextResponse.json({ error: friendshipFetchError.message }, { status: 500 });
  }

  if (existingFriendship?.id) {
    const { error: updateFriendshipError } = await adminClient
      .from("friendships")
      .update({
        status: "accepted",
        responded_at: new Date().toISOString()
      })
      .eq("id", existingFriendship.id);

    if (updateFriendshipError) {
      return NextResponse.json({ error: updateFriendshipError.message }, { status: 500 });
    }
  } else {
    const { error: insertFriendshipError } = await adminClient.from("friendships").insert({
      requester_id: demoUser.id,
      addressee_id: user.id,
      status: "accepted",
      responded_at: new Date().toISOString()
    });

    if (insertFriendshipError) {
      return NextResponse.json({ error: insertFriendshipError.message }, { status: 500 });
    }
  }

  const { count: climbCount, error: countError } = await adminClient
    .from("climbs")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", demoUser.id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (!climbCount) {
    const { error: seedError } = await adminClient.from("climbs").insert(
      DEMO_CLIMBS.map((climb) => ({
        ...climb,
        profile_id: demoUser.id
      }))
    );

    if (seedError) {
      return NextResponse.json({ error: seedError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    demoName: DEMO_NAME
  });
}
