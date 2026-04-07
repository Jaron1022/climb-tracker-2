import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo@climbtracker.local";
const DEMO_PASSWORD = "ClimbDemo123!";
const DEMO_NAME = "Demo Crusher";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "Demo account setup needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
      },
      { status: 500 }
    );
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    const demoUser = await ensureDemoUser(adminClient);
    await ensureDemoProfile(adminClient, demoUser.id);
    await ensureDemoClimbs(adminClient, demoUser.id);
    await ensureDemoSessionNotes(adminClient, demoUser.id);

    const authorizationHeader = request.headers.get("authorization");
    const accessToken = authorizationHeader?.replace(/^Bearer\s+/i, "");
    if (accessToken) {
      const {
        data: { user }
      } = await authClient.auth.getUser(accessToken);

      if (user) {
        await ensureAcceptedFriendship(adminClient, user.id, demoUser.id);
      }
    }

    return NextResponse.json({
      ok: true,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare the demo account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function ensureDemoUser(adminClient: any) {
  const existingUser = await findUserByEmail(adminClient, DEMO_EMAIL);

  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: DEMO_NAME
      }
    });

    if (error) {
      throw error;
    }

    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      display_name: DEMO_NAME
    }
  });

  if (error || !data.user) {
    throw error ?? new Error("Could not create the demo account.");
  }

  return data.user;
}

async function findUserByEmail(adminClient: any, email: string) {
  let page = 1;

  while (page <= 5) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw error;
    }

    const matchingUser = data.users.find((user: any) => user.email?.toLowerCase() === email.toLowerCase());
    if (matchingUser) {
      return matchingUser;
    }

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return null;
}

async function ensureDemoProfile(adminClient: any, userId: string) {
  const { error } = await adminClient.from("profiles").upsert(
    {
      id: userId,
      display_name: DEMO_NAME,
      device_id: "supabase-account"
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

async function ensureDemoClimbs(adminClient: any, userId: string) {
  const { count, error } = await adminClient
    .from("climbs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const today = new Date();
  const sampleClimbs = [
    makeDemoClimb(userId, offsetDate(today, -6), "V2", true, null, ["slab", "technical"], "blue", "Felt snappy once the feet clicked."),
    makeDemoClimb(userId, offsetDate(today, -6), "V3", false, "-", ["vertical", "crimpy"], "red", "Needed a second go to trust the right hand."),
    makeDemoClimb(userId, offsetDate(today, -3), "V3", true, null, ["overhang", "compression"], "green", "Best send of the week."),
    makeDemoClimb(userId, offsetDate(today, -3), "V4", false, "-", ["vertical", "static"], "white", "Nearly flashed this one."),
    makeDemoClimb(userId, offsetDate(today, -1), "V2", true, null, ["arete", "balancey"], "purple", "Fun arete movement."),
    makeDemoClimb(userId, offsetDate(today, -1), "V4", false, null, ["overhang", "powerful"], "orange", "Finally stuck the swing move.")
  ];

  const { error: insertError } = await adminClient.from("climbs").insert(sampleClimbs);

  if (insertError) {
    throw insertError;
  }
}

async function ensureDemoSessionNotes(adminClient: any, userId: string) {
  const today = new Date();
  const rows = [
    {
      profile_id: userId,
      session_on: offsetDate(today, -6),
      note: "Easy volume day. Mostly focusing on clean feet and pacing.",
      updated_at: new Date().toISOString()
    },
    {
      profile_id: userId,
      session_on: offsetDate(today, -3),
      note: "Felt strong on steep movement and finally linked the crux.",
      updated_at: new Date().toISOString()
    },
    {
      profile_id: userId,
      session_on: offsetDate(today, -1),
      note: "Short session, but the orange V4 finally went down.",
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await adminClient.from("session_notes").upsert(rows, {
    onConflict: "profile_id,session_on"
  });

  if (error) {
    throw error;
  }
}

async function ensureAcceptedFriendship(adminClient: any, leftUserId: string, rightUserId: string) {
  if (leftUserId === rightUserId) {
    return;
  }

  const { data, error } = await adminClient
    .from("friendships")
    .select("id,status")
    .or(`and(requester_id.eq.${leftUserId},addressee_id.eq.${rightUserId}),and(requester_id.eq.${rightUserId},addressee_id.eq.${leftUserId})`)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.id) {
    if (data.status !== "accepted") {
      const { error: updateError } = await adminClient
        .from("friendships")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString()
        })
        .eq("id", data.id);

      if (updateError) {
        throw updateError;
      }
    }

    return;
  }

  const { error: insertError } = await adminClient.from("friendships").insert({
    requester_id: leftUserId,
    addressee_id: rightUserId,
    status: "accepted",
    responded_at: new Date().toISOString()
  });

  if (insertError) {
    throw insertError;
  }
}

function makeDemoClimb(
  userId: string,
  climbedOn: string,
  grade: string,
  flashed: boolean,
  gradeModifier: "-" | "+" | null,
  styleTags: string[],
  wallName: string,
  notes: string
) {
  return {
    profile_id: userId,
    photo_url: null,
    grade,
    flashed,
    grade_modifier: gradeModifier,
    style_tags: styleTags,
    wall_name: wallName,
    notes,
    status: "completed",
    climbed_on: climbedOn
  };
}

function offsetDate(date: Date, offsetDays: number) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + offsetDays);
  const year = next.getFullYear();
  const month = `${next.getMonth() + 1}`.padStart(2, "0");
  const day = `${next.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
