// GET /api/count -> { count, cap } for the founding-members counter, or { count: null } when no
// store is configured (the page then hides the counter). Cached at the edge so a traffic spike
// from a viral video costs one Redis read per half minute, not one per visitor.

const { CAP, getCount } = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
  try {
    return res.status(200).json({ count: await getCount(), cap: CAP });
  } catch (err) {
    console.error('count error', err);
    return res.status(200).json({ count: null, cap: CAP });
  }
};
