(function initialisePortfolioContent(global) {
  "use strict";

  const portfolio = global.Portfolio || (global.Portfolio = {});

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }

    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

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
    terminal: {
      placeholderSuffix: " is not available in the prototype.",
      unknownCommand:
        "Command not recognised. Type help for available options.",
      themeHelp: {
        ariaLabel: "Theme information",
        heading: "THEME",
        currentLabel: "Current",
        usageLabel: "Usage",
        usage: "theme <dark|light>",
      },
      themeSetPrefix: "Theme set to ",
      lightThemeJoke: "Ouch. Your eyes have filed a formal complaint.",
      speechStopped: "Reading stopped.",
      speechUnsupported:
        "Text-to-speech is not available in this browser.",
    },
    help: {
      ariaLabel: "Available portfolio options",
      usageHeading: "USAGE",
      usage: "<command>",
      groups: [
        { id: "portfolio", heading: "PORTFOLIO" },
        { id: "terminal", heading: "TERMINAL" },
        { id: "themes", heading: "THEMES" },
        { id: "placeholder", heading: "COMING SOON", modifier: "pending" },
      ],
      tipHeading: "TIP",
      tip: "Type a command and press Enter.",
    },
    confused: {
      ariaLabel: "How this page works",
      heading: "HOW THIS WORKS",
      introduction:
        "This is a website pretending to be a command-line terminal.",
      instructions: [
        "Type a command at the prompt and press Enter.",
        "Start with help to see what is available.",
      ],
      reassurance: "Nothing you type here can harm your computer.",
    },
    contact: {
      ariaLabel: "Contact Stephen Barr",
      heading: "CONTACT",
      labels: {
        location: "Location",
        linkedin: "LinkedIn",
      },
    },
    about: {
      ariaLabel: "About Stephen Barr",
      heading: "ABOUT",
      readingStarted: "Reading the About section aloud.",
      paragraphs: [
        "Stephen is a hands-on engineering lead and systems architect based in Northern Ireland, UK.",
        "At Education Development Trust, he built a public-service platform from the ground up and continues to set its technical direction while delivering in C# and .NET.",
        "The platform supports multiple public-service programmes and hundreds of thousands of people. He leads and develops engineers, supports production and has reduced annual cloud costs substantially compared with the system it replaced.",
      ],
      portrait: {
        filename: "PORTRAIT.JPG",
        number: "[01]",
        source: "assets/stephen-barr.jpg",
        alternativeText: "Portrait of Stephen Barr",
        width: 1772,
        height: 1772,
        transferStatus: "IMAGE_RX / 56K",
      },
    },
    cv: {
      ariaLabel: "Stephen Barr abridged public curriculum vitae",
      reading: {
        started: "Reading a short chronological CV story aloud.",
        text: [
          "Stephen Barr is a hands-on engineering leader and software architect in Northern Ireland, with more than nine years of experience. He combines C sharp, dot net and Azure engineering with architecture, people leadership and responsibility for production services.",
          "His path into software began with computing at North West Regional College, followed by a computer games development degree at Ulster University. During his studies, he joined E and I Engineering as an intern. He later returned as a full-stack developer, building systems for inventory, logistics, manufacturing and maintenance.",
          "Stephen then worked at Foods Connected, delivering features and production fixes for a large supply-chain platform, before returning to E and I. He later moved to Education Development Trust, where he became a lead software engineer and systems architect.",
          "There, he built a configurable public-service platform now used across more than a dozen programmes supporting hundreds of thousands of people. He leads engineers, remains hands-on, owns production reliability, and reduced annual cloud costs by more than ninety percent.",
          "This is a short public overview. A more detailed CV is available through LinkedIn.",
        ].join(" "),
      },
      fileStatus: {
        filename: "OPENING STEPHEN_BARR.CV",
        mode: "[READ ONLY / ABRIDGED CV]",
      },
      pdf: {
        href: "assets/Stephen-Barr-CV.pdf",
        openLabel: "[View PDF]",
        opened: "Opened Stephen-Barr-CV.pdf in a new tab.",
      },
      identity: {
        title: "Engineering Lead | Software Architect",
      },
      notice: {
        label: "ABRIDGED CV",
        prefix: "A more detailed CV is available on request through ",
        linkLabel: "LinkedIn",
        suffix: ".",
      },
      profile: {
        ariaLabel: "Profile",
        heading: "01 / PROFILE",
        body: [
          "Hands-on engineering leader and software architect with more than nine",
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
        heading: "02 / PROFESSIONAL EXPERIENCE",
        entries: [
          {
            organisation: "Education Development Trust",
            role: "Lead Software Engineer / Systems Architect",
            dates: [],
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
            dates: [],
            subrole: {
              role: "Software Development Internship",
              dates: [],
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
            dates: [],
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
        heading: "03 / SELECTED PROJECTS",
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
        heading: "04 / CORE TECHNOLOGY",
        body: [
          "C#, .NET, ASP.NET Core, Blazor, SQL Server, Azure, Git, CI/CD, xUnit",
          "and OpenAI Codex.",
        ].join(" "),
      },
      education: {
        ariaLabel: "Education",
        heading: "05 / EDUCATION",
        entries: [
          {
            institution: "Ulster University",
            qualification: [
              "BEng (Hons) Computer Games Development with Diploma in Professional",
              "Practice",
            ].join(" "),
            dates: "",
          },
          {
            institution: "North West Regional College",
            qualification:
              "Higher National Diploma in Computing and Systems Development",
            dates: "",
          },
        ],
      },
      footer: {
        filename: "END OF STEPHEN_BARR.CV",
        marker: "[EOF]",
      },
    },
  };

  portfolio.content = deepFreeze(content);
})(globalThis);
