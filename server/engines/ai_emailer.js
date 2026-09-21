/**
 * Rynex Technologies - Contextual AI Outreach Email Generator
 * Enhanced with official Rynex Security production templates,
 * 4-step sequence (Initial, Followup 1, Followup 2, Breakup),
 * and branded HTML email rendering with logo and compliant footers.
 */

const fs = require('fs');
const path = require('path');

// Load config and HTML template
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'rynex_config.json');
const TEMPLATE_PATH = path.join(__dirname, '..', 'config', 'email_template.html');

let rynexConfig = {};
try {
  rynexConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.warn('[ai_emailer] Could not load rynex_config.json:', e.message);
}

let htmlTemplate = '';
try {
  htmlTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
} catch (e) {
  console.warn('[ai_emailer] Could not load email_template.html:', e.message);
}

/**
 * Convert plain text email body to clean HTML paragraphs
 */
function textToHtmlBody(text) {
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const clean = p.trim().replace(/\n/g, '<br/>');
      if (!clean) return '';
      if (clean.startsWith('---')) {
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/><p style="font-size:12px;color:#6b7280;line-height:1.5;">${clean.replace(/^---\s*/, '')}</p>`;
      }
      return `<p style="margin:0 0 16px 0;line-height:1.7;color:#374151;font-size:15px;">${clean}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Render Branded HTML Email Template
 */
function renderBrandedHtml({ subject, body, lead, senderProfile = {} }) {
  if (!htmlTemplate) return '';

  const companyName = lead.company_name || 'your company';
  const domain = lead.domain || lead.website || 'your website';
  const senderCompany = senderProfile.company || rynexConfig.company?.name || 'Rynex Security';
  const website = senderProfile.website || rynexConfig.company?.website || 'https://rynexsecurity.com';
  const contactEmail = senderProfile.from_email || rynexConfig.smtp?.from_email || 'info@rynexsecurity.com';
  const postalAddress = senderProfile.postal_address || rynexConfig.company?.postal_address || 'Rynex Security, Karachi, Pakistan';

  const footerRaw = rynexConfig.compliance?.footer ||
    'You are receiving this one-to-one business email because {company} is publicly listed as a business at {domain}. If you would rather not hear from us, just reply "unsubscribe" and we will remove you immediately.\n{sender_company} | {postal_address}';

  const footer = footerRaw
    .replace(/{company}/g, companyName)
    .replace(/{domain}/g, domain)
    .replace(/{sender_company}/g, senderCompany)
    .replace(/{postal_address}/g, postalAddress)
    .replace(/\n/g, '<br/>');

  const htmlBody = textToHtmlBody(body);

  let rendered = htmlTemplate
    .replace(/\{\{PREHEADER\}\}/g, subject || 'Security Assessment for ' + companyName)
    .replace(/\{\{BODY\}\}/g, htmlBody)
    .replace(/\{\{CONTACT_EMAIL\}\}/g, contactEmail)
    .replace(/\{\{WEBSITE\}\}/g, website)
    .replace(/\{\{FOOTER\}\}/g, footer);

  return rendered;
}

/**
 * Clean and parse LLM response into subject and body
 */
function parseAiEmailResponse(rawText, lead, yourOffer, senderProfile) {
  let subject = `Collaboration inquiry for ${lead.company_name}`;
  let body = rawText.trim();

  const subjectMatch = body.match(/^Subject:\s*([^\n\r]+)/i);
  if (subjectMatch) {
    subject = subjectMatch[1].trim().replace(/^["']|["']$/g, '');
    body = body.replace(/^Subject:\s*[^\n\r]+[\r\n]*/i, '').trim();
  }

  if (!body.toLowerCase().includes('unsubscribe') && !body.toLowerCase().includes('opt out')) {
    const postal = senderProfile.postal_address || rynexConfig.company?.postal_address || 'Rynex Security';
    body += `\n\n---\nYou are receiving this one-to-one business email because ${lead.company_name} is publicly listed at ${lead.domain || 'online'}. If you would rather not hear from us, simply reply "unsubscribe".\n${senderProfile.company || 'Rynex Security'} | ${postal}`;
  }

  return { subject, body };
}

/**
 * Build system and user prompt for cold outreach
 */
function buildOutreachPrompt(lead, yourOffer, senderProfile, tone = 'Consultative Problem-Solver', sequenceStage = 'initial') {
  const senderName = senderProfile.name || rynexConfig.company?.sender_name || 'Ayesha Malik';
  const senderTitle = senderProfile.title || rynexConfig.company?.sender_title || 'Business Development';
  const senderCompany = senderProfile.company || rynexConfig.company?.name || 'Rynex Security';
  const website = senderProfile.website || rynexConfig.company?.website || 'https://rynexsecurity.com';

  return `You are an elite B2B cybersecurity cold email strategist writing on behalf of ${senderCompany} (${website}).

TARGET COMPANY:
- Name: ${lead.company_name}
- Domain: ${lead.domain || lead.website}
- Industry / Niche: ${lead.niche || 'B2B'}
- Description: ${lead.description || 'Active business'}
- Detected Context / Need: ${lead.detected_need || 'Penetration testing and compliance'}

SENDER DETAILS:
- Company: ${senderCompany}
- Offer: ${yourOffer || 'Penetration testing (VAPT), 24/7 SOC monitoring, and GRC compliance readiness'}
- Sender: ${senderName}, ${senderTitle}
- Website: ${website}

SEQUENCE STAGE: ${sequenceStage.toUpperCase()} (Options: initial, followup_1, followup_2, followup_3)
TONE: ${tone}

RULES:
1. Start with "Subject: <Short, high open-rate subject under 6 words>" on the first line.
2. If sequenceStage is 'initial': Hook into what ${lead.company_name} does, connect to their detected need (${lead.detected_need}), explain ${senderCompany}'s solution, and ask for a low-friction 15-minute call.
3. If sequenceStage is 'followup_1': Reference your previous note, highlight how ${senderCompany} approaches testing/securing their environment, and ask if it's on their roadmap.
4. If sequenceStage is 'followup_2': Share common starting points/checklist for their industry, and suggest a quick scoping chat.
5. If sequenceStage is 'followup_3': Courteous break-up email stating you won't clutter their inbox, wish them the best, and leave the website link.
6. Keep under 120 words. No robotic fluff, no emojis, professional offensive-security tone.
7. Sign off with ${senderName}, ${senderTitle}, ${senderCompany}.`;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert B2B cold email copywriter. Always output clean text with Subject: on the first line.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 450
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call Google Gemini API
 */
async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Gemini API error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Call Groq API
 */
async function callGroq(apiKey, prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an expert B2B cold email copywriter. Always output clean text with Subject: on the first line.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 450
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Smart Built-in Contextual Outreach Engine (Using official Rynex Security config)
 */
function generateBuiltInContextualEmail(lead, yourOffer, senderProfile, tone, sequenceStage = 'initial', serviceKey = 'vapt') {
  const co = lead.company_name;
  const domain = lead.domain || lead.website || '';
  const senderName = senderProfile.name || rynexConfig.company?.sender_name || 'Ayesha Malik';
  const senderTitle = senderProfile.title || rynexConfig.company?.sender_title || 'Business Development';
  const senderCo = senderProfile.company || rynexConfig.company?.name || 'Rynex Security';
  const website = senderProfile.website || rynexConfig.company?.website || 'https://rynexsecurity.com';
  const fromEmail = senderProfile.from_email || rynexConfig.smtp?.from_email || 'info@rynexsecurity.com';
  const bookingLine = rynexConfig.company?.booking_link ? `You can also book directly: ${rynexConfig.company.booking_link}` : '';

  // Get service data from config or fallback
  const srv = rynexConfig.services?.[serviceKey] || rynexConfig.services?.vapt || {
    label: 'VAPT',
    phrase: 'penetration testing',
    subject: `Penetration testing for ${co}`,
    offer: 'Rynex Security runs real-world attack simulations (VAPT) against web apps, APIs, networks and cloud environments, so weaknesses are found and fixed before an attacker finds them.',
    deliverable: 'You get a clear, prioritised report your developers can act on straight away, with evidence for every finding and retesting to confirm the fixes.',
    checklist: 'exposed admin panels and forgotten subdomains, weak authentication and broken access control, misconfigured cloud storage, and unpatched internet-facing software'
  };

  const targetPersona = lead.primary_contact?.title || lead.decision_makers?.primaryPersona?.title;
  const greeting = targetPersona ? `Hello ${targetPersona} & ${co} team,` : `Hello ${co} team,`;

  // Determine Hook based on lead context and diagnostic evidence
  let hook = `I noticed ${co} while reviewing active companies in the ${lead.niche || 'technology'} sector.`;
  if (lead.diagnostic && lead.diagnostic.gaps && lead.diagnostic.gaps.length > 0) {
    const gap = lead.diagnostic.gaps[0];
    hook = `During an initial perimeter audit of ${domain || co}, we noted that ${gap.detail.toLowerCase()} Addressing this along with your web/API attack surface would directly strengthen your security posture.`;
  } else if (lead.detected_need && lead.detected_need.toLowerCase().includes('hipaa')) {
    hook = `${co} references healthcare compliance requirements, so I imagine patient data security and external auditing matter significantly to your clients.`;
  } else if (lead.detected_need && lead.detected_need.toLowerCase().includes('soc 2')) {
    hook = `I saw that ${co} operates in the financial/data space where compliance readiness (SOC 2, PCI DSS) is critical for client trust.`;
  } else if (lead.description && lead.description.length > 30) {
    hook = `I've been reviewing ${co}'s presence in ${lead.niche || 'the market'} and noticed your focus on ${lead.description.slice(0, 80)}.`;
  }

  let subject, bodyLines = [];

  if (sequenceStage === 'followup_1') {
    subject = `Following up on ${srv.phrase} for ${co}`;
    bodyLines = [
      greeting,
      '',
      `Just following up on my note from a few days ago regarding ${srv.phrase}. ${srv.deliverable}`,
      '',
      `If validating your security posture is on your roadmap for this quarter, I'd be glad to share how we would approach it for ${co}. ${bookingLine}`.trim(),
      '',
      'Best regards,',
      senderName,
      `${senderTitle}, ${senderCo}`,
      website
    ];
  } else if (sequenceStage === 'followup_2') {
    subject = `Common starting points for ${co} - ${srv.phrase}`;
    bodyLines = [
      greeting,
      '',
      `When we look at ${srv.phrase} for companies like ${co}, common areas where weaknesses hide include: ${srv.checklist}.`,
      '',
      `Happy to do a quick, no-obligation scoping chat if any of that sounds relevant to your current infrastructure. ${bookingLine}`.trim(),
      '',
      'Best regards,',
      senderName,
      `${senderTitle}, ${senderCo}`,
      website
    ];
  } else if (sequenceStage === 'followup_3') {
    subject = `Final note regarding ${co}`;
    bodyLines = [
      greeting,
      '',
      `I don't want to clutter your inbox, so this will be my last note. If the timing isn't right, no problem at all.`,
      '',
      `You can learn more about our attack simulations and monitoring at ${website} or reach us any time at ${fromEmail}.`,
      '',
      `Wishing ${co} all the best.`,
      '',
      'Best regards,',
      senderName,
      `${senderTitle}, ${senderCo}`
    ];
  } else {
    // Initial Email
    subject = srv.subject.replace('{company}', co);
    bodyLines = [
      greeting,
      '',
      hook,
      '',
      srv.offer,
      '',
      srv.deliverable,
      '',
      `Would you be open to a short 15-minute call next week to see whether our assessments could assist your team? ${bookingLine}`.trim(),
      '',
      'Best regards,',
      senderName,
      `${senderTitle}, ${senderCo}`,
      website
    ];
  }

  const postal = senderProfile.postal_address || rynexConfig.company?.postal_address || 'Rynex Security, Karachi, Pakistan';
  bodyLines.push(
    '',
    '---',
    `You are receiving this one-to-one business email because ${co} is publicly listed at ${domain || 'online'}. If you would rather not hear from us, just reply "unsubscribe" and we will remove you immediately.`,
    `${senderCo} | ${postal}`
  );

  return {
    subject,
    body: bodyLines.join('\n')
  };
}

/**
 * Main Email Generation entry point
 */
async function generateContextualEmail({
  lead,
  yourOffer = '',
  senderProfile = {},
  tone = 'Consultative Problem-Solver',
  sequenceStage = 'initial',
  serviceKey = 'vapt',
  provider = 'builtin',
  apiKey = null
}) {
  if (!lead || !lead.company_name) {
    throw new Error('Valid lead information is required');
  }

  const prompt = buildOutreachPrompt(lead, yourOffer, senderProfile, tone, sequenceStage);
  let rawAiOutput = null;
  let modelUsed = 'Rynex Contextual Engine';

  if (provider === 'openai' && apiKey) {
    try {
      rawAiOutput = await callOpenAI(apiKey, prompt);
      modelUsed = 'OpenAI (GPT-4o-mini)';
    } catch (err) {
      console.warn('[ai_emailer] OpenAI error, falling back to built-in:', err.message);
    }
  } else if (provider === 'gemini' && apiKey) {
    try {
      rawAiOutput = await callGemini(apiKey, prompt);
      modelUsed = 'Google Gemini (1.5 Flash)';
    } catch (err) {
      console.warn('[ai_emailer] Gemini error, falling back to built-in:', err.message);
    }
  } else if (provider === 'groq' && apiKey) {
    try {
      rawAiOutput = await callGroq(apiKey, prompt);
      modelUsed = 'Groq (Llama-3.3-70B)';
    } catch (err) {
      console.warn('[ai_emailer] Groq error, falling back to built-in:', err.message);
    }
  }

  let finalSubject, finalBody;

  if (rawAiOutput) {
    const parsed = parseAiEmailResponse(rawAiOutput, lead, yourOffer, senderProfile);
    finalSubject = parsed.subject;
    finalBody = parsed.body;
  } else {
    const fallback = generateBuiltInContextualEmail(lead, yourOffer, senderProfile, tone, sequenceStage, serviceKey);
    finalSubject = fallback.subject;
    finalBody = fallback.body;
    modelUsed = 'Rynex Security Engine (config v2)';
  }

  // Render branded HTML version
  const renderedHtml = renderBrandedHtml({
    subject: finalSubject,
    body: finalBody,
    lead,
    senderProfile
  });

  return {
    subject: finalSubject,
    body: finalBody,
    html: renderedHtml,
    modelUsed,
    sequenceStage,
    serviceKey,
    leadContext: {
      company: lead.company_name,
      domain: lead.domain,
      detected_need: lead.detected_need
    }
  };
}

module.exports = {
  generateContextualEmail,
  renderBrandedHtml,
  callOpenAI,
  callGemini,
  callGroq,
  generateBuiltInContextualEmail,
  rynexConfig
};
