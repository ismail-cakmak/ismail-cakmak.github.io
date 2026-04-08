window.POSTS_CONTENT = {
  "generatedAt": "2026-04-07T19:19:09.009Z",
  "posts": [
    {
      "slug": "building-a-personal-website-with-github-pages",
      "title": "Building a Personal Website with GitHub Pages",
      "date": "2026-03-15",
      "tags": [
        "web",
        "design"
      ],
      "excerpt": "Why I kept the stack static, how I organized content, and the tradeoffs that came with it.",
      "file": "posts/building-a-personal-website-with-github-pages.md",
      "body": "---\ntitle: Building a Personal Website with GitHub Pages\ndate: 2026-03-15\ntags: web, design\nexcerpt: Why I kept the stack static, how I organized content, and the tradeoffs that came with it.\n---\n\nI wanted a website that would stay simple long after the excitement of launching it wore off. That meant avoiding extra infrastructure, keeping the pages static, and making sure the content lived in plain files that I could edit quickly.\n\nGitHub Pages ended up being the right fit because it removes most of the operational overhead. I can update a file, push it, and the site changes without needing a database, a CMS, or a deployment pipeline that only I understand.\n\n## What mattered most\n\n- Fast page loads\n- Content stored in a format I can read locally\n- A structure that would still make sense six months later\n\nThe hardest part was not the styling. It was deciding how much machinery the site actually needed. Once I stopped trying to make it behave like a product, the implementation got much calmer.\n"
    },
    {
      "slug": "thoughts-on-minimalism-in-software",
      "title": "Thoughts on Minimalism in Software",
      "date": "2026-02-28",
      "tags": [
        "software"
      ],
      "excerpt": "Simplicity is not about having fewer files. It is about making the right things obvious.",
      "file": "posts/thoughts-on-minimalism-in-software.md",
      "body": "---\ntitle: Thoughts on Minimalism in Software\ndate: 2026-02-28\ntags: software\nexcerpt: Simplicity is not about having fewer files. It is about making the right things obvious.\n---\n\nMinimalism in software is often confused with reduction. People remove features, delete abstractions, or compress code and call the result simpler. Sometimes it is. Often it just becomes harder to understand.\n\nThe version of minimalism I care about is structural. It means the system has a small number of concepts, each concept has a clear boundary, and the common path is easy to trace without mental gymnastics.\n\n> Simplicity is a property of understanding, not only of implementation size.\n\nThat is why a straightforward script can be more maintainable than a flexible framework layer, even if the framework looks cleaner in isolation.\n"
    },
    {
      "slug": "learning-in-public-a-year-in-review",
      "title": "Learning in Public: A Year in Review",
      "date": "2026-01-10",
      "tags": [
        "personal"
      ],
      "excerpt": "The biggest gains came from writing down what I was confused about before I solved it.",
      "file": "posts/learning-in-public-a-year-in-review.md",
      "body": "---\ntitle: Learning in Public: A Year in Review\ndate: 2026-01-10\ntags: personal\nexcerpt: The biggest gains came from writing down what I was confused about before I solved it.\n---\n\nThis year I got more value from small public notes than from any polished long-form post. Short writeups forced me to turn vague intuition into concrete language, and that exposed the gaps in my thinking much faster.\n\nA useful pattern emerged. Whenever I felt stuck, I wrote three things:\n\n- What I believed\n- What evidence I had\n- What would prove me wrong\n\nThat habit made debugging easier, improved technical conversations, and gave me a record of how my understanding changed over time.\n"
    },
    {
      "slug": "the-art-of-writing-clean-code",
      "title": "The Art of Writing Clean Code",
      "date": "2025-12-05",
      "tags": [
        "engineering"
      ],
      "excerpt": "Clean code is less about elegance in the abstract and more about reducing future uncertainty.",
      "file": "posts/the-art-of-writing-clean-code.md",
      "body": "---\ntitle: The Art of Writing Clean Code\ndate: 2025-12-05\ntags: engineering\nexcerpt: Clean code is less about elegance in the abstract and more about reducing future uncertainty.\n---\n\nClean code is usually discussed as a style preference, but the real benefit is operational. A clean codebase lowers the cost of answering questions like \"what will this break?\" and \"where does this value come from?\"\n\nI tend to look for three signs that a piece of code is healthy:\n\n- Names match intent\n- Side effects are easy to spot\n- The happy path is visible without scrolling through helper layers\n\nWhen those properties are missing, even correct code becomes expensive because every change starts with re-deriving context.\n"
    },
    {
      "slug": "why-i-switched-to-static-sites",
      "title": "Why I Switched to Static Sites",
      "date": "2025-11-18",
      "tags": [
        "web"
      ],
      "excerpt": "Static sites let me spend my effort on content and design instead of maintaining a publishing system.",
      "file": "posts/why-i-switched-to-static-sites.md",
      "body": "---\ntitle: Why I Switched to Static Sites\ndate: 2025-11-18\ntags: web\nexcerpt: Static sites let me spend my effort on content and design instead of maintaining a publishing system.\n---\n\nI used to assume a \"real\" site needed a dynamic backend. In practice, most of what I publish changes slowly and is read far more often than it is edited. That makes static delivery a better default than I gave it credit for.\n\nThe benefits were immediate: fewer moving parts, fewer failure modes, and hosting that costs essentially nothing. The tradeoff is that content workflows need a little forethought, especially if you want posts to stay pleasant to edit.\n\nFor a personal site, that is a trade I will take every time.\n"
    }
  ]
};
