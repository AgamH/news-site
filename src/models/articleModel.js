const mongoose = require('mongoose');

const ARTICLE_STATUSES = ['draft', 'pending', 'published', 'returned'];
const CATEGORIES = ['News', 'Politics', 'Economy', 'Technology', 'Sports', 'Culture', 'Opinion', 'Entertainment', 'Science'];
const EDITABLE_STATUSES = ['draft', 'returned', 'published'];

const publishedSnapshotSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, required: true, trim: true, maxlength: 400 },
    content: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '', trim: true },
    category: { type: String, required: true, enum: CATEGORIES },
    publishedAt: { type: Date, required: true },
  },
  { _id: false },
);

const articleSchema = new mongoose.Schema(
  {
    // The working copy is autosaved while the reporter types, so it may be incomplete.
    // Completeness is enforced by parseArticleInput before a manual save or a submission,
    // and the public snapshot (publishedSnapshotSchema) still requires every field.
    title: { type: String, default: '', trim: true, maxlength: 200 },
    summary: { type: String, default: '', trim: true, maxlength: 400 },
    content: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: '', trim: true },
    category: { type: String, required: true, enum: CATEGORIES },

    status: { type: String, enum: ARTICLE_STATUSES, default: 'draft', required: true, index: true },
    editorNote: { type: String, default: '', trim: true },

    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reporterName: { type: String, required: true, trim: true },

    views: { type: Number, default: 0 },

    published: { type: publishedSnapshotSchema, default: null },
    publishHistory: { type: [{ publishedAt: { type: Date, required: true } }], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_document, returnedObject) => {
        returnedObject.id = returnedObject._id.toString();
        delete returnedObject._id;
        delete returnedObject.reporter;
        return returnedObject;
      },
    },
  },
);

articleSchema.index({ 'published.title': 'text', 'published.summary': 'text', reporterName: 'text' });
articleSchema.index({ 'published.publishedAt': -1 });

articleSchema.methods.isLive = function isLive() {
  return Boolean(this.published);
};

articleSchema.methods.submitForApproval = function submitForApproval() {
  if (!EDITABLE_STATUSES.includes(this.status)) {
    throw Object.assign(new Error('Only a draft, returned, or published article can be submitted for approval.'), { statusCode: 409 });
  }
  this.status = 'pending';
  this.editorNote = '';
};

articleSchema.methods.approveAndPublish = function approveAndPublish() {
  if (this.status !== 'pending') {
    throw Object.assign(new Error('Only a pending article can be approved.'), { statusCode: 409 });
  }
  const publishedAt = new Date();
  this.published = {
    title: this.title,
    summary: this.summary,
    content: this.content,
    imageUrl: this.imageUrl,
    category: this.category,
    publishedAt,
  };
  this.publishHistory.push({ publishedAt });
  this.status = 'published';
  this.editorNote = '';
};

articleSchema.methods.returnToReporter = function returnToReporter(note) {
  if (this.status !== 'pending') {
    throw Object.assign(new Error('Only a pending article can be returned.'), { statusCode: 409 });
  }
  this.status = 'returned';
  this.editorNote = String(note || '').trim();
};

const Article = mongoose.models.Article || mongoose.model('Article', articleSchema);

const DEMO_COMIC_STORIES = [
  {
    title: 'Secret Wars: The Black Suit Mystery',
    category: 'Culture',
    summary: 'Comic-book archive: after a distant-world conflict, Spider-Man returns with a powerful black suit and questions about its influence.',
    body: 'The unfamiliar costume amplifies Peter Parker’s abilities, but its growing hold on his choices turns a useful discovery into a personal mystery.',
  },
  {
    title: 'The Clone Saga: Another Peter Steps Forward',
    category: 'News',
    summary: 'Comic-book archive: a long-lost clone returns, forcing Peter Parker to reconsider his identity and his place in the city.',
    body: 'The arrival challenges the assumptions behind Peter’s life. Friends and rivals must decide what makes a person more than a name or a memory.',
  },
  {
    title: 'Kraven’s Last Hunt: The Hunter’s Final Game',
    category: 'Sports',
    summary: 'Comic-book archive: Kraven the Hunter sets out to prove he can surpass Spider-Man on the hero’s own ground.',
    body: 'The contest becomes a study of obsession and identity, with Kraven trying to demonstrate that he understands the masked hero better than anyone.',
  },
  {
    title: 'The Night Gwen Stacy Changed Everything',
    category: 'Culture',
    summary: 'Comic-book archive: a tragedy involving Gwen Stacy reshapes Peter Parker’s relationships and his sense of responsibility.',
    body: 'The story follows the lasting consequences for Peter and the people closest to him, rather than treating hero work as consequence-free spectacle.',
  },
  {
    title: 'The Green Goblin Knows Who Is Under the Mask',
    category: 'Politics',
    summary: 'Comic-book archive: the Green Goblin discovers Spider-Man’s identity, turning a private secret into a threat to Peter’s everyday life.',
    body: 'Peter must weigh protecting his friends against confronting an enemy who now understands where the hero’s public and private worlds meet.',
  },
  {
    title: 'Civil War: Spider-Man Makes His Identity Public',
    category: 'Politics',
    summary: 'Comic-book archive: during the superhero registration conflict, Spider-Man publicly reveals his identity and faces the cost.',
    body: 'The decision places Peter at the center of a wider argument about oversight, security, and whether extraordinary power should answer to the public.',
  },
  {
    title: 'One More Day: A Choice with a Lasting Price',
    category: 'Opinion',
    summary: 'Comic-book archive: Peter Parker faces an impossible personal choice, and the consequences alter the shape of his life.',
    body: 'The arc asks what a hero may sacrifice for family, and whether changing the past can ever leave the people involved unchanged.',
  },
  {
    title: 'Superior Spider-Man: A Different Mind Behind the Mask',
    category: 'Technology',
    summary: 'Comic-book archive: Doctor Octopus takes over Peter Parker’s life and attempts to become a more effective Spider-Man.',
    body: 'A new mind applies its own methods to Peter’s memories and responsibilities, raising hard questions about whether good outcomes excuse harmful choices.',
  },
  {
    title: 'Spider-Verse: A Web Across Many Worlds',
    category: 'Science',
    summary: 'Comic-book archive: Spider-heroes from alternate realities unite against a threat targeting their shared legacy.',
    body: 'The crossover expands the familiar New York story into a multiverse, while keeping Peter’s decisions connected to the people who rely on him.',
  },
  {
    title: 'Venom: The Symbiote Finds a New Host',
    category: 'News',
    summary: 'Comic-book archive: after separating from Peter, the alien symbiote bonds with Eddie Brock and becomes Venom.',
    body: 'The former costume carries memories of Spider-Man into a new partnership, creating an adversary whose motives are personal as well as powerful.',
  },
  {
    title: 'The Hobgoblin Mystery Grips Manhattan',
    category: 'News',
    summary: 'Comic-book archive: an imitator with stolen Goblin technology launches a long-running mystery across the city.',
    body: 'Spider-Man follows clues through a maze of false leads, showing how a hidden identity can turn even a neighborhood rumor into a citywide puzzle.',
  },
  {
    title: 'The Sinister Six Coordinate a Citywide Challenge',
    category: 'Politics',
    summary: 'Comic-book archive: six of Spider-Man’s foes combine their talents in an attempt to overwhelm one hero.',
    body: 'The team-up turns familiar rivalries into a test of planning and endurance, while Peter searches for a way to protect people caught in the middle.',
  },
  {
    title: 'Spider-Island: Ordinary New Yorkers Gain Powers',
    category: 'Science',
    summary: 'Comic-book archive: a citywide outbreak gives New Yorkers spider-like abilities and forces Spider-Man to respond.',
    body: 'The event asks what happens when power reaches everyone at once, as Peter works to help a city learning its new limits in real time.',
  },
  {
    title: 'Maximum Carnage: A City Faces a New Threat',
    category: 'News',
    summary: 'Comic-book archive: Carnage brings a dangerous campaign to New York, pushing Spider-Man to seek unlikely allies.',
    body: 'The crossover centers on the choices required to protect the city and the uneasy cooperation between heroes who do not agree on methods.',
  },
  {
    title: 'Back in Black: Peter Returns to the Shadows',
    category: 'Opinion',
    summary: 'Comic-book archive: after danger reaches his family, Peter adopts a darker approach to protecting those closest to him.',
    body: 'The arc examines the line between resolve and retaliation, and how fear can change the way a hero treats both opponents and allies.',
  },
  {
    title: 'The Other: Peter Confronts a Change Within',
    category: 'Science',
    summary: 'Comic-book archive: a personal crisis leads Peter Parker to question the source and limits of his spider abilities.',
    body: 'The story turns inward, using a difficult transformation to explore Peter’s resilience and the responsibilities that survive a change in power.',
  },
  {
    title: 'Brand New Day: Spider-Man Starts Over',
    category: 'Culture',
    summary: 'Comic-book archive: a new status quo sends Peter back into city life with fresh complications and familiar duties.',
    body: 'New cases, old friends, and changing circumstances reset the rhythm of Peter’s adventures without removing the everyday pressures beneath the mask.',
  },
  {
    title: 'The Lizard’s Cure Comes at a Cost',
    category: 'News',
    summary: 'Comic-book archive: Dr. Curt Connors’s search for a cure repeatedly collides with the dangerous Lizard transformation.',
    body: 'Peter is caught between stopping a threat and helping a scientist whose experiments began with the hope of repairing what was lost.',
  },
  {
    title: 'The Scorpion Returns to Settle an Old Score',
    category: 'News',
    summary: 'Comic-book archive: Mac Gargan’s Scorpion persona brings a personal rivalry back to Spider-Man’s streets.',
    body: 'Their confrontations revisit the consequences of turning a private grievance into a public danger, with the neighborhood paying attention.',
  },
  {
    title: 'Spider-Man and the Question of Responsibility',
    category: 'Opinion',
    summary: 'Comic-book archive: across decades of stories, Peter Parker’s choices return to one question about power and responsibility.',
    body: 'This retrospective connects several turning points in the comics, from secret identities to citywide crises, through Peter’s efforts to make amends.',
  },
];

const DEMO_PLACEHOLDER_MARKER = 'This is placeholder demo content generated for grading and local testing.';

function createDemoComicArticle(sequence) {
  const story = DEMO_COMIC_STORIES[(sequence - 1) % DEMO_COMIC_STORIES.length];
  const title = `${story.title} (${sequence})`;
  return {
    title,
    summary: story.summary,
    content: `${story.summary}\n\n${story.body}`,
    category: story.category,
  };
}

async function rethemeDemoArticlesIfNeeded() {
  const articles = await Article.find({ content: { $regex: /This is placeholder demo content generated for grading and local testing\./ } })
    .select('title published')
    .lean();
  if (!articles.length) return 0;

  const operations = articles.map((article, index) => {
    const titleMatch = /\((\d+)\)$/.exec(article.title || '');
    const sequence = titleMatch ? Number.parseInt(titleMatch[1], 10) : index + 1;
    const story = createDemoComicArticle(sequence);
    const $set = {
      title: story.title,
      summary: story.summary,
      content: story.content,
      category: story.category,
    };

    if (article.published) {
      $set['published.title'] = story.title;
      $set['published.summary'] = story.summary;
      $set['published.content'] = story.content;
      $set['published.category'] = story.category;
    }

    return { updateOne: { filter: { _id: article._id }, update: { $set } } };
  });

  const result = await Article.bulkWrite(operations);
  return result.modifiedCount;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

async function seedArticlesIfEmpty(reporters, options = {}) {
  if (await Article.exists({})) return;
  if (!reporters || reporters.length === 0) return;
  const total = options.total || 500;
  const now = Date.now();
  const articles = [];

  for (let i = 0; i < total; i += 1) {
    const reporter = pick(reporters);
    const story = createDemoComicArticle(i + 1);
    const { title: headline, summary, content, category } = story;
    const publishedDaysAgo = randomInt(0, 120);
    const firstPublishedAt = new Date(now - publishedDaysAgo * 24 * 60 * 60 * 1000);
    const roll = Math.random();
    let status;
    if (roll < 0.72) status = 'published';
    else if (roll < 0.85) status = 'pending';
    else if (roll < 0.93) status = 'draft';
    else status = 'returned';

    const doc = {
      title: headline,
      summary,
      content,
      imageUrl: '',
      category,
      status,
      editorNote: status === 'returned' ? 'Please add a quote from an official source and re-submit.' : '',
      reporter: reporter.id,
      reporterName: reporter.name,
      views: 0,
      published: null,
      publishHistory: [],
    };

    if (status === 'published' || status === 'pending' || status === 'returned') {
      const alreadyLive = status !== 'pending' || Math.random() < 0.5;
      if (alreadyLive || status === 'published') {
        doc.published = {
          title: headline,
          summary,
          content,
          imageUrl: '',
          category,
          publishedAt: firstPublishedAt,
        };
        doc.publishHistory.push({ publishedAt: firstPublishedAt });
        doc.views = randomInt(20, 2000);

        if (Math.random() < 0.15 && publishedDaysAgo > 5) {
          const secondPublishedAt = new Date(firstPublishedAt.getTime() + randomInt(2, publishedDaysAgo - 1) * 24 * 60 * 60 * 1000);
          doc.published.publishedAt = secondPublishedAt;
          doc.publishHistory.push({ publishedAt: secondPublishedAt });
        }
      }
    }

    articles.push(doc);
  }

  const inserted = await Article.insertMany(articles);
  return inserted;
}

module.exports = {
  Article,
  ARTICLE_STATUSES,
  CATEGORIES,
  EDITABLE_STATUSES,
  rethemeDemoArticlesIfNeeded,
  seedArticlesIfEmpty,
};