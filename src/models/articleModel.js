const mongoose = require('mongoose');

const ARTICLE_STATUSES = ['draft', 'pending', 'published', 'returned'];
const CATEGORIES = ['News', 'Politics', 'Economy', 'Technology', 'Sports', 'Culture', 'Opinion'];
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
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, required: true, trim: true, maxlength: 400 },
    content: { type: String, required: true, trim: true },
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

const DEMO_HEADLINE_TEMPLATES = [
  'City Council Approves New Transit Line',
  'Tech Sector Adds Thousands of Jobs',
  'Local Team Clinches Division Title',
  'Museum Unveils Restored Historic Wing',
  'Regional Elections See Record Turnout',
  'Startup Raises Major Funding Round',
  'New Park Opens After Years of Delay',
  'Heatwave Breaks Decade-Old Record',
  'University Launches Research Center',
  'Film Festival Announces This Year\u2019s Lineup',
  'Central Bank Holds Interest Rates Steady',
  'Hospital Opens New Emergency Wing',
  'Water Shortage Prompts Conservation Push',
  'Local Business Marks 50 Years in Operation',
  'Championship Game Ends in Dramatic Finish',
  'Downtown District Sees Major Renovation',
  'Scientists Report Breakthrough Discovery',
  'Public Transit Fares to Change Next Month',
  'Art Exhibit Draws Record Crowds',
  'Farmers Report Strong Harvest Season',
];

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
    const category = pick(CATEGORIES);
    const headline = `${pick(DEMO_HEADLINE_TEMPLATES)} (${i + 1})`;
    const publishedDaysAgo = randomInt(0, 120);
    const firstPublishedAt = new Date(now - publishedDaysAgo * 24 * 60 * 60 * 1000);
    const roll = Math.random();
    let status;
    if (roll < 0.72) status = 'published';
    else if (roll < 0.85) status = 'pending';
    else if (roll < 0.93) status = 'draft';
    else status = 'returned';

    const content = `${headline}. This is placeholder demo content generated for grading and local testing. `
      + 'Paragraph one covers the background of the story. Paragraph two covers reactions from people involved. '
      + 'Paragraph three covers what happens next.';
    const summary = `A quick summary of: ${headline.toLowerCase()}.`;

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
  seedArticlesIfEmpty,
};