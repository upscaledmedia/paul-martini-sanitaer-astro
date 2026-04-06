interface Env {
  CF_TURNSTILE_SECRET: string;
  GHL_WEBHOOK_URL: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Ungültige Anfrage.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = formData.get('cf-turnstile-response');
  if (!token || typeof token !== 'string') {
    return new Response(JSON.stringify({ success: false, error: 'Turnstile-Verifikation fehlt.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify Turnstile token
  const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.CF_TURNSTILE_SECRET,
      response: token,
      remoteip: request.headers.get('CF-Connecting-IP') ?? '',
    }),
  });

  const turnstileData = (await turnstileRes.json()) as { success: boolean };
  if (!turnstileData.success) {
    return new Response(JSON.stringify({ success: false, error: 'Bot-Verifikation fehlgeschlagen.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward to GHL webhook
  const payload = {
    name: formData.get('name') ?? '',
    telefon: formData.get('telefon') ?? '',
    email: formData.get('email') ?? '',
    betreff: formData.get('betreff') ?? '',
    nachricht: formData.get('nachricht') ?? '',
    source: 'paul-martini-sanitaer.de',
  };

  try {
    await fetch(env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Log silently — don't expose internal errors to user
  }

  // Redirect to thank-you page
  return Response.redirect(new URL('/danke/', request.url).toString(), 303);
};
