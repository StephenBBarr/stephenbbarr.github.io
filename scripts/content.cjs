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
  siteOrigin: "https://stephenbarr.com",
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
      focusOn: "FocusOn enquiries",
    },
    focusOn: {
      email: "hello@focusoncrm.com",
      href: "mailto:hello@focusoncrm.com",
    },
  },
  about: {
    ariaLabel: "About Stephen Barr",
    headline: "Founder of FocusOn CRM",
    subtitle: "Software architect and engineer",
    readingStarted: "Reading the About section aloud.",
    focusOn: {
      label: "FocusOn CRM",
      href: "https://www.focusoncrm.com/",
    },
    paragraphs: [
      "I’m Stephen Barr, based in Northern Ireland and the founder of FocusOn CRM. I’m building software for organisations delivering employment, skills and careers programmes, helping their teams coordinate support and record the progress people make.",
      "My focus is building and supporting FocusOn CRM for the long term. I lead its direction, design its architecture and write the software. That means thinking about the whole business: understanding what customers need, deciding what to build and creating a product they can rely on.",
      "I bring more than ten years of experience designing software, leading engineering teams and running services in production. My work spans public services and industry, with responsibility for reliability, cost and the continued development of the systems I build.",
      "Here, I share my work, experience and writing about what I’m building and learning along the way.",
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
      started: "Reading a short CV summary aloud.",
      text: [
        "Stephen Barr is the founder of FocusOn CRM, a software architect and engineer based in Northern Ireland, with more than ten years of experience.",
        "His focus is building and supporting FocusOn CRM for the long term. He leads its direction, designs its architecture and writes software for organisations delivering employment, skills and careers programmes. It gives each programme its own workspace, helping teams coordinate support and record people’s progress.",
        "At Education Development Trust, he built a configurable public-service platform used across more than a dozen programmes supporting hundreds of thousands of people. His work included leading and developing engineers, running production services and reducing annual cloud costs by more than ninety percent.",
        "His earlier work at E and I Engineering and Foods Connected covered full-stack development for manufacturing, logistics and supply-chain systems. He brings a strong C sharp, dot net and Azure background, supported by automated testing and AI-assisted development with human review.",
        "He studied computing at North West Regional College and computer games development at Ulster University.",
        "This is a short public overview. A more detailed CV is available through LinkedIn.",
      ].join(" "),
    },
    pdf: {
      href: "/assets/Stephen-Barr-CV.pdf",
      downloadLabel: "Download CV (PDF)",
    },
    identity: {
      title: "Founder of FocusOn CRM | Software Architect and Engineer",
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
        "Founder of FocusOn CRM and a hands-on software architect and engineer",
        "with more than ten years of experience. Building software for",
        "organisations delivering employment, skills and careers programmes,",
        "with responsibility for business direction, product development and",
        "software architecture. Brings experience leading engineering teams,",
        "delivering large public-service platforms and running reliable production",
        "services. Focused on building and supporting FocusOn CRM for the long term.",
      ].join(" "),
    },
    experience: {
      ariaLabel: "Professional experience",
      entries: [
        {
          organisation: "FocusOn CRM",
          href: "https://www.focusoncrm.com/",
          role: "Founder, Software Architect and Engineer",
          achievements: [
            {
              lead: "Business and product direction:",
              body: "Lead the business, set product priorities and guide development around customer needs.",
            },
            {
              lead: "Architecture and development:",
              body: [
                "Design and build a configurable .NET platform for organisations",
                "delivering employment, skills and careers programmes.",
              ].join(" "),
            },
            {
              lead: "Programme flexibility:",
              body: [
                "Build separate programme workspaces within one shared system,",
                "supporting different activities, outcomes and delivery needs.",
              ].join(" "),
            },
            {
              lead: "Reliable foundations:",
              body: [
                "Build access controls, versioned evidence management and resilient",
                "background processing, supported by automated testing and",
                "AI-assisted development with human review.",
              ].join(" "),
            },
          ],
        },
        {
          organisation: "Education Development Trust",
          role: "Systems Architect / Lead Software Engineer",
          achievements: [
            {
              lead: "Built and scaled a public-service platform:",
              body: [
                "Designed a configurable, multi-tenant platform that replaced",
                "repeated bespoke development and expanded across more than a",
                "dozen programmes supporting",
                "hundreds of thousands of people.",
              ].join(" "),
            },
            {
              lead: "Led and developed engineers:",
              body: [
                "Remained hands-on in C#/.NET while leading engineers and analysts.",
                "Recruited engineers, designed technical assessments and supported",
                "progression through feedback and coaching. Met every agreed",
                "programme deadline by balancing scope and priorities.",
              ].join(" "),
            },
            {
              lead: "Owned production reliability:",
              body: [
                "Resolved application, data, cloud and integration issues and added",
                "controls to prevent recurrence. Delivered software within ISO 27001",
                "and Cyber Essentials Plus requirements.",
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
              lead: "Introduced controlled AI-assisted delivery:",
              body: [
                "Established workflows for planning, implementation, testing and",
                "review, retaining human approval for technical decisions and",
                "production releases.",
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
