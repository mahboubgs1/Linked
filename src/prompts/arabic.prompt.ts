/**
 * Arabic-first language rules for the content generator.
 * Kept separate so the voice can be tuned without touching generator code.
 */

export const ARABIC_VOICE_RULES = [
  'اكتب المحتوى بالعربية الفصحى المبسّطة (Modern Standard Arabic) الموجهة للمحترفين.',
  'استخدم المصطلحات التقنية بالإنجليزية بشكل طبيعي عند الحاجة (مثل: Incident, SLA, Root Cause, Change Management) دون ترجمتها بشكل متكلّف.',
  'تجنّب اللغة التحفيزية الزائدة والعبارات العامة؛ اكتب بأسلوب عملي مبني على خبرة حقيقية في إدارة تطبيقات الـ IT.',
  'اجعل الجُمل قصيرة وواضحة وقابلة للقراءة على LinkedIn (أسطر قصيرة، فراغات بين الفقرات).',
].join('\n');
