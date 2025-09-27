export interface WellnessVideoResource {
  topic: string;
  category: string;
  youtubeTitle: string;
  channel: string;
  url: string;
  duration: string; // MM:SS or HH:MM:SS
  videoType: "practice" | "explainer" | "interview" | "longform" | string;
  summary: string;
  keyTakeaways: string[];
  evidenceNotes: string;
  recommendedUse: string;
}

export interface WellnessMetaSummary {
  totalVideos: number;
  avgDurationMinutes: number;
  shortUsagePlan: string[];
  disclaimer: string;
}

export const wellnessResources: WellnessVideoResource[] = [
  {
    topic: "Mindfulness-Based CBT",
    category: "Mindfulness",
    youtubeTitle: "Mindfulness Based Cognitive Behavioral Therapy",
    channel: "Care India YouTube",
    url: "https://www.youtube.com/watch?v=SKLr2eBZfGY",
    duration: "59:47",
    videoType: "explainer",
    summary: "Explains and demos actionable mindfulness and CBT techniques, including body scan and mindful eating.",
    keyTakeaways: ["Mindfulness helps stress resistance", "Proven with meta-analyses", "Multiple techniques demoed"],
    evidenceNotes: "Demonstrates techniques supported by published meta-analyses for anxiety, stress, resilience.",
    recommendedUse: "Weekly or when seeking skills overview",
  },
  {
    topic: "Mindfulness & Self-Compassion",
    category: "Self-Compassion",
    youtubeTitle: "Introduction to Mindfulness & Self-Compassion Practices",
    channel: "UC San Diego Health",
    url: "https://www.youtube.com/watch?v=UmoqJA0sqSA",
    duration: "53:04",
    videoType: "longform",
    summary: "Certified MBSR teacher guides body scan, loving-kindness, and supportive self-talk techniques.",
    keyTakeaways: ["Body scan practice", "Compassion meditation", "Coping skills for stress"],
    evidenceNotes: "Leads practices from validated MBSR and self-compassion protocols.",
    recommendedUse: "Evening unwind, self-reflection, or stress recovery",
  },
  {
    topic: "Breathing Exercises for Stress",
    category: "Breathing Practice",
    youtubeTitle: "Top Breathing Exercises for Stress Relief & Mental Health",
    channel: "NCHPAD",
    url: "https://www.youtube.com/watch?v=UHTogAEyvNs",
    duration: "03:16",
    videoType: "practice",
    summary: "Therapist demos six breathing techniques, including box, belly, and hum breathing—accessible for all.",
    keyTakeaways: ["Box breathing", "Auditory/forced sighing", "Belly & counting breaths"],
    evidenceNotes: "Includes techniques used in CBT, trauma-informed care, MBSR programs.",
    recommendedUse: "Morning routine or in stressful moments",
  },
  {
    topic: "Mindful Living",
    category: "Mindfulness",
    youtubeTitle: "Learn how to reduce stress through Mindful Living",
    channel: "Mayo Clinic",
    url: "https://www.youtube.com/watch?v=dZmQOt6Z1QE",
    duration: "03:24",
    videoType: "explainer",
    summary: "Mayo Clinic expert introduces mindful living, mindfully coping with stress and anxiety.",
    keyTakeaways: ["Present moment focus", "Mindful breathing", "Benefits for stress & anxiety"],
    evidenceNotes: "Based on Mayo Clinic 4-week Mindful Living program.",
    recommendedUse: "Daily micro-break",
  },
  {
    topic: "Self-Compassion Exercise",
    category: "Self-Compassion",
    youtubeTitle: "Self-Compassion Exercise – Maintaining Good Mental Health",
    channel: "Theroyal.ca",
    url: "https://www.youtube.com/watch?v=xo-qhBe2SMY",
    duration: "10:14",
    videoType: "practice",
    summary: "Positive psychology approach for daily self-compassion maintenance—guided exercise.",
    keyTakeaways: ["Honest acceptance", "Daily mental hygiene", "Small habits improve wellness"],
    evidenceNotes: "Supported by self-compassion and positive psychology research.",
    recommendedUse: "Daily mental hygiene practice",
  },
  {
    topic: "Workplace Burnout & Resilience",
    category: "Workplace Burnout",
    youtubeTitle: "Thrive Mental Wellbeing FREE Webinar | Mindfulness",
    channel: "Thrive Mental Wellbeing",
    url: "https://www.youtube.com/watch?v=lpgSrkOYD0M",
    duration: "51:07",
    videoType: "longform",
    summary: "Business psychologist shares workplace-focused resilience, solution-based mindfulness, and meditation tools.",
    keyTakeaways: ["Solution-focused", "Meditation for burnout", "Workplace wellness tips"],
    evidenceNotes: "Psychologist-presented, references empirically supported approaches.",
    recommendedUse: "Workplace lunch-and-learn or team wellness session",
  },
  {
    topic: "Stress Relief Breathing Demo",
    category: "Breathing Practice",
    youtubeTitle: "Health 360 With Sneha Mordani: Experts Advise Deep Breathing",
    channel: "Health 360",
    url: "https://www.youtube.com/watch?v=DCxFMKrzOfo",
    duration: "42:19",
    videoType: "longform",
    summary: "Doctors demonstrate quick-acting breathing and CBT exercises for anxiety and stress.",
    keyTakeaways: ["CBT for anxiety", "Doctor demo of breathing", "Real-time techniques"],
    evidenceNotes: "Medical expert-led, combines CBT and breathing protocols.",
    recommendedUse: "Acute anxiety; stress crisis toolkit",
  },
  {
    topic: "Mindfulness for Mental Health",
    category: "Mindfulness",
    youtubeTitle: "Try Mindfulness to Support Your Mental Health",
    channel: "Oxford Mindfulness Centre",
    url: "https://www.youtube.com/watch?v=ZvrqJYXS-G4",
    duration: "11:22",
    videoType: "explainer",
    summary: "Overview of evidence-based mindfulness programs for mental health (MBCT, MBSR, Self-Compassion).",
    keyTakeaways: ["MBCT & MBSR intro", "Benefits for depression & anxiety", "How to get started"],
    evidenceNotes: "Oxford Mindfulness Centre, clinical trials supported.",
    recommendedUse: "Beginner exploration, foundation skills",
  },
];

export const wellnessMetaSummary: WellnessMetaSummary = {
  totalVideos: 8,
  avgDurationMinutes: 30,
  shortUsagePlan: [
    "Begin with a breathing practice or mindful living video in the morning.",
    "Add a self-compassion and stress demo mid-day or late afternoon.",
    "Watch a workplace resilience or mindfulness session for work-life balance.",
    "Mix daily: rotate longer mindfulness/CBT practices with shorter guided ones.",
    "End week with a deep-dive self-compassion, CBT, or breathing longform video.",
  ],
  disclaimer: "Not medical advice; seek professional help for clinical concerns.",
};
