"use strict";

const person = {
  name: "Stephen Barr",
  location: "Northern Ireland, UK",
  linkedin: {
    label: "linkedin.com/in/stephenbbarr",
    href: "https://www.linkedin.com/in/stephenbbarr",
  },
};

const content = {
  person,
  siteOrigin: "https://stephenbbarr.github.io",
  navigation: [
    { id: "about", label: "About", href: "/" },
    { id: "cv", label: "CV", href: "/cv/" },
    { id: "blog", label: "Blog", href: "/blog/" },
    { id: "contact", label: "Contact", href: "/contact/" },
  ],
  contact: {
    ariaLabel: "Contact Stephen Barr",
    labels: {
      location: "Location",
      linkedin: "LinkedIn",
    },
  },
  about: {
    ariaLabel: "About Stephen Barr",
    headline: "Software architect and engineering lead",
    readingStarted: "Reading the About section aloud.",
    paragraphs: [
      "I’m Stephen Barr, based in Northern Ireland. I build public-service platforms, lead engineers, and stay hands-on with C#, .NET and Azure.",
    ],
    portrait: {
      source: "/assets/stephen-barr.jpg",
      alternativeText: "Portrait of Stephen Barr",
      width: 1772,
      height: 1772,
    },
  },
  cv: {
    ariaLabel: "Stephen Barr abridged public curriculum vitae",
    reading: {
      started: "Reading a short chronological CV story aloud.",
      text: [
        "Stephen Barr is a hands-on software architect and engineering leader in Northern Ireland, with more than nine years of experience. He combines C sharp, dot net and Azure engineering with architecture, people leadership and responsibility for production services.",
        "His path into software began with computing at North West Regional College, followed by a computer games development degree at Ulster University. During his studies, he joined E and I Engineering as an intern. He later returned as a full-stack developer, building systems for inventory, logistics, manufacturing and maintenance.",
        "Stephen then worked at Foods Connected, delivering features and production fixes for a large supply-chain platform, before returning to E and I. He later moved to Education Development Trust, where he became a systems architect and lead software engineer.",
        "There, he built a configurable public-service platform now used across more than a dozen programmes supporting hundreds of thousands of people. He leads engineers, remains hands-on, owns production reliability, and reduced annual cloud costs by more than ninety percent.",
        "This is a short public overview. A more detailed CV is available through LinkedIn.",
      ].join(" "),
    },
    pdf: {
      href: "/assets/Stephen-Barr-CV.pdf",
      downloadLabel: "Download CV (PDF)",
    },
    identity: {
      title: "Software Architect | Engineering Lead",
    },
    notice: {
      label: "Abridged CV",
      prefix: "A more detailed CV is available on request through ",
      linkLabel: "LinkedIn",
      suffix: ".",
    },
    profile: {
      ariaLabel: "Profile",
      body: [
        "Hands-on software architect and engineering leader with more than nine",
        "years of experience designing and delivering software. Combines a strong",
        "C#/.NET and Azure background with architecture, people leadership and",
        "operational ownership. Leads multidisciplinary teams, develops engineers",
        "and works with senior stakeholders to balance scope, cost, risk and",
        "delivery. Uses controlled AI-assisted engineering practices while",
        "retaining human accountability for technical decisions and production",
        "releases.",
      ].join(" "),
    },
    experience: {
      ariaLabel: "Professional experience",
      entries: [
        {
          organisation: "Education Development Trust",
          role: "Systems Architect / Lead Software Engineer",
            achievements: [
            {
              lead: "Built a public-service platform from the ground up:",
              body: [
                "Designed a configurable, multi-tenant platform that replaced",
                "repeated bespoke development with reusable capabilities.",
              ].join(" "),
            },
            {
              lead: "Scaled the platform successfully:",
              body: [
                "Expanded it across more than a dozen programmes supporting",
                "hundreds of thousands of people.",
              ].join(" "),
            },
            {
              lead: "Set technical direction:",
              body: [
                "Remained hands-on in C#/.NET while leading engineers and analysts",
                "through architecture decisions and fixed-date delivery.",
              ].join(" "),
            },
            {
              lead: "Delivered consistently:",
              body: [
                "Met every agreed programme deadline by balancing priorities, scope",
                "and practical alternatives.",
              ].join(" "),
            },
            {
              lead: "Developed engineering capability:",
              body: [
                "Recruited engineers, designed technical assessments and supported",
                "progression through clear expectations, feedback and coaching.",
              ].join(" "),
            },
            {
              lead: "Introduced responsible AI-assisted delivery:",
              body: [
                "Established controlled workflows for planning, implementation,",
                "testing and review, with human approval retained.",
              ].join(" "),
            },
            {
              lead: "Owned production reliability:",
              body: [
                "Led the investigation and resolution of application, data, cloud",
                "and integration issues, adding controls to prevent recurrence.",
              ].join(" "),
            },
            {
              lead: "Reduced annual cloud costs by more than 90%:",
              body: [
                "Replaced continuously running workloads with event-driven services",
                "and improved storage, database and caching efficiency.",
              ].join(" "),
            },
            {
              lead: "Worked within audited controls:",
              body: [
                "Delivered software within ISO 27001 and Cyber Essentials Plus",
                "requirements.",
              ].join(" "),
            },
          ],
        },
        {
          organisation: "E+I Engineering Ltd.",
          role: "Software Systems Developer",
            subrole: {
            role: "Software Development Internship",
              },
          achievements: [
            {
              lead: "Independent delivery:",
              body: "Designed and delivered full-stack .NET applications.",
            },
            {
              lead: "Operational systems:",
              body: [
                "Built systems supporting inventory, logistics, manufacturing and",
                "maintenance workflows.",
              ].join(" "),
            },
            {
              lead: "Full-stack breadth:",
              body: [
                "Worked across application development, databases, user interfaces,",
                "cloud services and delivery pipelines.",
              ].join(" "),
            },
          ],
        },
        {
          organisation: "Foods Connected Ltd.",
          role: "Software Systems Developer",
            achievements: [
            {
              lead: "Full-stack delivery:",
              body: "Delivered features for a large supply-chain platform.",
            },
            {
              lead: "Product development:",
              body: [
                "Implemented business logic, web interfaces, product changes and",
                "production fixes.",
              ].join(" "),
            },
          ],
        },
      ],
    },
    projects: {
      ariaLabel: "Selected projects",
      entries: [
        {
          name: "AI Careers-support Prototype",
          achievements: [
            {
              lead: "Applied AI:",
              body: [
                "Built an AI-assisted prototype for transcription, summarisation and",
                "contextual careers information using anonymised inputs.",
              ].join(" "),
            },
          ],
        },
        {
          name: "FocusOn CRM",
          achievements: [
            {
              lead: "Independent product development:",
              body: [
                "Designed and developed a configurable, multi-tenant .NET product.",
              ].join(" "),
            },
            {
              lead: "Secure and resilient foundations:",
              body: [
                "Built layered security, versioned evidence management and resilient",
                "background processing.",
              ].join(" "),
            },
            {
              lead: "Controlled AI engineering:",
              body: [
                "Uses automated testing and controlled AI-assisted development with",
                "human review.",
              ].join(" "),
            },
          ],
        },
      ],
    },
    technology: {
      ariaLabel: "Core technology",
      body: [
        "C#, .NET, ASP.NET Core, Blazor, SQL Server, Azure, Git, CI/CD, xUnit",
        "and OpenAI Codex.",
      ].join(" "),
    },
    education: {
      ariaLabel: "Education",
      entries: [
        {
          institution: "Ulster University",
          qualification: [
            "BEng (Hons) Computer Games Development with Diploma in Professional",
            "Practice",
          ].join(" "),
          },
        {
          institution: "North West Regional College",
          qualification:
            "Higher National Diploma in Computing and Systems Development",
          },
      ],
    },
  },
};

module.exports = content;
