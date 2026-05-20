import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import bg2 from "../assets/bg2.jpg";

const slides = [
  {
    id: 0,
    image: bg2,
    title: "Enchanted Meadow",
    subtitle: "Golden light and soft color for mindful balance",
  },
];

const sections = [
  {
    id: "explore",
    title: "Understanding Emotional Wellbeing",
    content: [
      "Emotional well-being is an important part of overall wellness. It influences how people think, react to situations, and interact with others in daily life.",

      "MeloMind helps users develop a deeper understanding of their emotions through intelligent emotion analysis. By identifying patterns such as stress, happiness, frustration, or calmness, the system helps users recognize what affects their emotional state.",

      "When people become aware of their emotional patterns, they are better able to manage stress, make thoughtful decisions, and build emotional resilience. This awareness plays a key role in maintaining a healthy and balanced life."
    ]
  },
  {
    id: "about",
    title: "About MeloMind",
    content: [
      "MeloMind is a digital emotional well-being platform designed to support emotional wellness through technology and mindful practices.",

      "The platform integrates AI-based emotion detection, music therapy, and guided wellness activities to help users understand and manage their emotional state in a healthier way.",

      "By combining emotional insights with supportive tools such as calming music, breathing exercises, and mindfulness guidance, MeloMind aims to create a safe and accessible environment where individuals can improve their emotional wellbeing."
    ]
  },
  {
    id: "tips",
    title: "Wellness Practices and Emotional Care",
    content: [
      "Maintaining emotional balance requires regular self-care and mindful habits. MeloMind encourages users to practice techniques that help reduce stress and improve emotional stability.",

      "Music therapy plays an important role because certain sound frequencies and rhythms can influence brain activity and emotional responses, helping people feel calmer and more relaxed.",

      "In addition to music therapy, practices such as breathing exercises, meditation, journaling, and gentle yoga can help individuals reconnect with themselves and maintain better emotional health."
    ]
  },
  {
    id: "blogs",
    title: "Insights on Emotional Health",
    content: [
      "Understanding emotions is an important step toward personal growth and emotional well-being.",

      "This section provides insights into how emotions influence behavior, relationships, and productivity in everyday life.",

      "Through informative articles and wellness guidance, users can learn about managing stress, recognizing emotional triggers, and developing healthier coping strategies."
    ]
  },

  {
    id: "contact",
    title: "Contact & Support",
    content: [
      "If you have questions about MeloMind or need help using the platform, our support team is here to assist you.",

      "We welcome feedback, suggestions, and collaboration ideas that can help improve emotional wellbeing resources and user experience.",

      "Feel free to reach out for technical support, general inquiries, or guidance about our emotion analysis and music therapy features."
    ]
  }

];

const Home = () => {
  const active = 0;
  const sectionsRef = useRef({});

  const scrollTo = (id) => {
    sectionsRef.current[id]?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#fff7ff" }}>
      {/* ===== HERO SECTION ===== */}
      <section className="relative h-screen w-full overflow-hidden">
        {/* Background images */}
        <AnimatePresence mode="sync">
          <motion.div
            key={active}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <img
              src={slides[active].image}
              alt={slides[active].title}
              className="h-full w-full object-cover object-center"
            />
          </motion.div>
        </AnimatePresence>

        {/* Content */}
        <div className="relative z-10 flex h-full items-center px-8 md:px-16 lg:px-24">
          <div className="max-w-3xl">
            <motion.p
              className="mb-5 text-xs font-semibold uppercase tracking-[0.24em]"
              style={{ color: "#f8fbff", textShadow: "0 2px 10px rgba(6,26,47,0.82)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              Guided emotional wellness
            </motion.p>
            <motion.h1
              className="text-5xl md:text-7xl font-extrabold leading-tight mb-6"
              style={{
                color: "#FFFFFF",
                letterSpacing: "0",
                textShadow: "0 2px 2px rgba(6,26,47,0.72), 0 10px 24px rgba(0,0,0,0.48)",
                fontFamily: "'Cinzel Decorative', 'Plus Jakarta Sans', serif",
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Discover
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #0077b7 0%, #00fff7 24%, #00bfb2 58%, #130061 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 2px 2px rgba(255, 255, 255, 0), 0 9px 20px rgba(0,0,0,0.72)",
                }}
              >
                Inner Balance
              </span>{" "}
              Through Emotion
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl leading-relaxed max-w-md"
              style={{ color: "#f8fbff", textShadow: "0 2px 12px rgba(6,26,47,0.9)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Understand your emotions, reduce stress, and find balance
              through AI-powered insights and therapeutic music.
            </motion.p>
            <motion.button
              onClick={() => scrollTo("explore")}
              className="home-hero-link mt-8 px-8 py-4 text-sm font-bold"
              style={{
                border: "1.5px solid rgba(255,255,255,0.86)",
                color: "#ffffff",
                textShadow: "0 3px 14px rgba(0,0,0,0.72)",
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.35 }}
            >
              Begin the Journey
            </motion.button>
          </div>
        </div>

        {/* Footer links at bottom of hero */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 flex justify-center gap-8 py-6"
        >
          {["Explore", "About Us", "Tips", "Blogs", "Contact"].map(
            (label, i) => (
              <button
                key={label}
                onClick={() => scrollTo(sections[i].id)}
                className="home-hero-link border border-[#2394ff] bg-transparent px-3 py-1 text-sm font-medium tracking-wide transition-colors duration-200"
                style={{ color: "#ffffff", textShadow: "0 3px 14px rgba(0,0,0,0.78)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "#ffe66d")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "#ffffff")
                }
              >
                {label}
              </button>
            )
          )}
        </div>
      </section>

      {/* ===== INFO SECTIONS ===== */}
      {sections.map((section, i) => (
        <section
          key={section.id}
          ref={(el) => { sectionsRef.current[section.id] = el; }}
          className="py-24 px-8 md:px-16 lg:px-24"
          style={{
            background: i % 2 === 0 ? "#fffaf2" : "#f5fff5",
          }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2
              className="text-3xl md:text-4xl font-extrabold mb-6"
              style={{ color: "#24143f" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {section.title}
            </motion.h2>
            <div
              className="space-y-4 text-lg leading-relaxed"
              style={{ color: "#4B5563" }}
            >
              {section.content.map((paragraph, index) => (
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  {paragraph}
                </motion.p>
              ))}
            </div>

            {section.id === "contact" && (
              <motion.div
                className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 text-left"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="rounded-lg border border-[#dcead1] bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-[#6b7f90] font-semibold">Support Email</p>
                  <p className="mt-1 text-[#253342] font-semibold">support@melomind.ai</p>
                </div>
                <div className="rounded-lg border border-[#dcead1] bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-[#6b7f90] font-semibold">Phone</p>
                  <p className="mt-1 text-[#253342] font-semibold">+91 98765 43210</p>
                </div>
                <div className="rounded-lg border border-[#dcead1] bg-white p-5 shadow-sm md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-[#6b7f90] font-semibold">Office Address</p>
                  <p className="mt-1 text-[#253342] font-semibold">
                    MeloMind Wellness Lab, 4th Floor, MG Road, Bengaluru, Karnataka 560001, India
                  </p>
                  <p className="mt-2 text-sm text-[#516f90]">
                    Support Hours: Monday to Saturday, 9:00 AM to 7:00 PM IST
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </section>
      ))}

      {/* Bottom footer */}
      <footer
        className="py-8 text-center text-sm"
        style={{ background: "#160c30", color: "#f8f1d0" }}
      >
        2026 MeloMind. All rights reserved.
      </footer>
    </div>
  );
};

export default Home;
