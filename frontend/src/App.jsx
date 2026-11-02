import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, BookOpen, Briefcase, FileText, Gauge, Layers3, Target, TrendingUp, UploadCloud, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

const initialForm = {
  jobTitle: 'Senior Data Scientist',
  companyName: 'Northstar AI',
  jobDescription:
    'We are hiring a Senior Data Scientist to lead analytics and machine learning initiatives for product and business teams. The ideal candidate is strong in Python, SQL, machine learning, statistics, data visualization, communication, and problem solving. Experience with experimentation, model lifecycle management, and stakeholder communication is preferred. Responsibilities include designing and deploying predictive models for product and revenue optimization, writing efficient SQL queries and building reporting pipelines, presenting analysis and recommendations to business stakeholders, and collaborating across engineering, product, and marketing teams. Applicants should have a bachelor’s or master’s degree in Computer Science, Statistics, Mathematics, Economics, or a related field, and 4+ years of experience in data science or applied analytics roles.',
  manualSkills: 'Python, SQL, Machine Learning, Statistics, Data Visualization, Communication, Problem Solving',
};

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [resumeFile, setResumeFile] = useState(null);
  const [jobFile, setJobFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/history`);
      if (!response.ok) return;
      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setError('Cannot reach the analysis service. Make sure the backend is running at localhost:8000, then try again.');
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const summaryCards = useMemo(() => {
    if (!analysis) {
      return [
        { label: 'Total resumes analyzed', value: history.length, icon: FileText },
        { label: 'Average match', value: '0%', icon: Gauge },
        { label: 'Missing skills', value: '0', icon: Target },
        { label: 'Courses recommended', value: '0', icon: BookOpen },
      ];
    }

    const matchScore = Number(analysis.match_percentage || 0);
    const missing = Array.isArray(analysis.missing) ? analysis.missing.length : 0;
    const courses = Array.isArray(analysis.recommendations) ? analysis.recommendations.length : 0;
    const averageMatch = Math.round(
      (history.reduce((sum, item) => sum + Number(item.match_score || 0), 0) + matchScore) /
        Math.max(history.length + 1, 1),
    );

    return [
      { label: 'Total resumes analyzed', value: history.length + 1, icon: FileText },
      { label: 'Average match', value: `${averageMatch}%`, icon: Gauge },
      { label: 'Missing skills', value: String(missing), icon: Target },
      { label: 'Courses recommended', value: String(courses), icon: BookOpen },
    ];
  }, [analysis, history]);

  const donutData = useMemo(() => {
    if (!analysis) return [{ name: 'Matched', value: 0 }, { name: 'Partial', value: 0 }, { name: 'Missing', value: 0 }];
    return [
      { name: 'Matched', value: analysis.matched?.length || 0 },
      { name: 'Partial', value: analysis.partial?.length || 0 },
      { name: 'Missing', value: analysis.missing?.length || 0 },
    ];
  }, [analysis]);

  const similarityData = useMemo(() => {
    if (!analysis) return [];
    return (analysis.skill_matches || []).map((item) => ({
      skill: item.skill,
      score: Math.round((item.score || 0) * 100),
    }));
  }, [analysis]);

  const skillTable = useMemo(() => analysis?.skill_matches || [], [analysis]);

  const handleFileChange = (setter) => (event) => setter(event.target.files?.[0] || null);

  const handleAnalyze = async () => {
    if (!resumeFile) {
      setError('Please upload a resume PDF or DOCX before analyzing.');
      return;
    }
    if (!jobFile && !form.jobDescription.trim()) {
      setError('Please upload a job description or paste one into the job description field.');
      return;
    }

    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('job_title', form.jobTitle);
    formData.append('company_name', form.companyName);
    formData.append('job_description', form.jobDescription);
    formData.append('manual_skills', form.manualSkills);
    if (resumeFile) formData.append('resume_file', resumeFile);
    if (jobFile) formData.append('job_file', jobFile);

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || 'The documents could not be analyzed. Please check the files and try again.');
      }
      if (!payload.analysis) {
        throw new Error('The analysis service returned no results. Please try again.');
      }
      setAnalysis(payload.analysis);
      await loadHistory();
    } catch (requestError) {
      setError(requestError.message || 'Could not analyze the documents. Check that the backend is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!analysis) return;
    const response = await fetch(`${API_BASE}/api/report/${analysis.id}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skill-gap-report-${analysis.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteHistory = async (id) => {
    await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' });
    await loadHistory();
    if (analysis && analysis.id === id) {
      setAnalysis(null);
    }
  };

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex h-11 w-11 items-center justify-center rounded-2xl">
              <Layers3 size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">AI-powered career insights</p>
              <h1 className="text-lg font-semibold tracking-tight text-white">AI Skill-to-Job Gap Analyzer</h1>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-sm md:flex">
            <button className="secondary-btn rounded-full px-4 py-2">Overview</button>
            <button className="secondary-btn rounded-full px-4 py-2">Reports</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-6 lg:py-10">
        <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl md:p-8">
          <div className="hero-layout flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
            <div className="hero-copy max-w-2xl">
              <span className="soft-pill mb-4">A little more clarity for your next move</span>
              <h2 className="text-3xl font-black tracking-tight text-white md:text-5xl">
                Your experience, <span className="gradient-text">in the right context.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm text-slate-300 md:text-base">
                See how your experience lines up with a role, what may be missing, and where to focus next. No guesswork, just a useful place to start.
              </p>
              <div className="hero-footnote mt-6 flex items-center gap-3 text-xs text-slate-400">
                <span className="hero-rule" />
                <span>Made for people figuring out their next step</span>
              </div>
            </div>

            <div className="hero-scoreboard grid min-w-[280px] gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="hero-stat glass-panel rounded-2xl p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Skills in common</div>
                <div className="mt-3 text-3xl font-bold text-cyan-300">{analysis ? `${Math.round(analysis.match_percentage || 0)}%` : '—'}</div>
                <div className="mt-1 text-xs text-slate-400">A starting point, not a verdict</div>
              </div>
              <div className="hero-stat hero-stat-alt glass-panel rounded-2xl p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Worth exploring</div>
                <div className="mt-3 text-3xl font-bold text-amber-300">{analysis ? `${Math.round(analysis.gap_percentage || 0)}%` : '—'}</div>
                <div className="mt-1 text-xs text-slate-400">Skills to build or bring forward</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="metric-card glass-panel rounded-3xl p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                  <Icon size={16} />
                </span>
              </div>
              <div className="metric-value font-black text-white">{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-8 xl:grid-cols-[1.45fr_0.55fr]">
          <div className="section-card glass-panel rounded-[2rem] p-6 md:p-7">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resume + job input</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Start with the role</h2>
              </div>
              <button onClick={handleAnalyze} disabled={loading} className="primary-btn rounded-2xl px-5 py-3 text-sm font-semibold shadow-lg disabled:opacity-60">
                {loading ? 'Analyzing...' : 'Analyze profile'}
              </button>
            </div>
            {error && (
              <div role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Job title</span>
                <input placeholder="e.g. Product designer" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className="data-input w-full rounded-2xl px-3 py-3" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Company name</span>
                <input placeholder="Optional" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="data-input w-full rounded-2xl px-3 py-3" />
              </label>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm text-slate-300">Job description</span>
                <textarea placeholder="Paste the job description here. You can include the responsibilities and skills that matter most." value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} rows={8} className="data-input w-full rounded-2xl p-3" />
              </label>

              <label className="file-drop flex cursor-pointer items-center rounded-2xl p-4 text-slate-300">
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange(setResumeFile)} />
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><UploadCloud size={18} /></span>
                  <div>
                    <div className="font-medium text-white">Upload resume</div>
                    <div className="text-xs text-slate-400">{resumeFile ? resumeFile.name : 'PDF / DOCX'}</div>
                  </div>
                </div>
              </label>

              <label className="file-drop flex cursor-pointer items-center rounded-2xl p-4 text-slate-300">
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleFileChange(setJobFile)} />
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><Briefcase size={18} /></span>
                  <div>
                    <div className="font-medium text-white">Upload job description</div>
                    <div className="text-xs text-slate-400">{jobFile ? jobFile.name : 'Optional PDF / DOCX'}</div>
                  </div>
                </div>
              </label>
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm text-slate-300">Manual skills</span>
              <input placeholder="e.g. Figma, research, prototyping" value={form.manualSkills} onChange={(e) => setForm({ ...form, manualSkills: e.target.value })} className="data-input w-full rounded-2xl px-3 py-3" />
            </label>
          </div>

          <aside className="glass-panel rounded-[2rem] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Quick insights</h3>
              <Activity className="text-cyan-300" size={20} />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <div className="flex items-center gap-2 text-sm text-cyan-300"><Layers3 size={16} /> Candidate readiness</div>
                <div className="mt-3 text-3xl font-black text-white">{analysis ? `${Math.round(analysis.match_percentage || 0)}%` : '—'}</div>
              </div>

              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                <div className="flex items-center gap-2 text-sm text-amber-300"><TrendingUp size={16} /> Skill gap</div>
                <div className="mt-3 text-3xl font-black text-white">{analysis ? `${Math.round(analysis.gap_percentage || 0)}%` : '—'}</div>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="flex items-center gap-2 text-sm text-emerald-300"><Target size={16} /> Top missing skill</div>
                <div className="mt-3 text-lg font-semibold text-white">{analysis ? (analysis.missing?.[0]?.skill || 'None') : '—'}</div>
              </div>
            </div>
          </aside>
        </section>

        {analysis && (
          <section className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="section-card glass-panel rounded-[2rem] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Performance</p>
                  <h3 className="mt-2 text-xl font-bold text-white">Skill match breakdown</h3>
                </div>
                <button onClick={handleDownload} className="secondary-btn rounded-xl px-3 py-2 text-sm">Download PDF</button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={donutData} innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={3}>
                        {donutData.map((entry, index) => (
                          <Cell key={entry.name} fill={['#76aef8', '#83bca8', '#e1938e'][index]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  {donutData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ background: ['#76aef8', '#83bca8', '#e1938e'][index] }} />
                        <span>{entry.name}</span>
                      </div>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <h3 className="mb-4 text-xl font-bold text-white">Skill gap summary</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">Total required skills: <strong className="text-white">{analysis.skills?.required?.length || 0}</strong></li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">Matched: <strong className="text-emerald-300">{analysis.matched?.length || 0}</strong></li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">Partial: <strong className="text-amber-300">{analysis.partial?.length || 0}</strong></li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">Missing: <strong className="text-rose-300">{analysis.missing?.length || 0}</strong></li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">Match percentage: <strong className="text-cyan-300">{analysis.match_percentage}%</strong></li>
                <li className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">Gap percentage: <strong className="text-cyan-300">{analysis.gap_percentage}%</strong></li>
              </ul>
            </div>
          </section>
        )}

        {analysis && (
          <section className="mt-8 grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="glass-panel rounded-[2rem] p-6">
              <h3 className="mb-5 text-xl font-bold text-white">Detailed skill matching</h3>
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Candidate skill</th>
                      <th>Similarity</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skillTable.map((row) => (
                      <tr key={row.skill}>
                        <td>{row.skill}</td>
                        <td>{row.candidate_skill || '—'}</td>
                        <td>{Math.round((row.score || 0) * 100)}%</td>
                        <td>
                          <span className={cx('status-chip', row.status === 'Matched' && 'bg-emerald-500/15 text-emerald-300', row.status === 'Partial' && 'bg-amber-500/15 text-amber-300', row.status === 'Missing' && 'bg-rose-500/15 text-rose-300')}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <h3 className="mb-5 text-xl font-bold text-white">Recommended learning</h3>
              <div className="space-y-3">
                {(analysis.recommendations || []).slice(0, 5).map((item, index) => (
                  <div key={`${item.skill}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{item.title}</div>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-300">{item.provider}</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{item.skill} · {item.difficulty} · {item.duration}</div>
                    <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300">View course <ArrowRight size={12} /></a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {analysis && (
          <section className="mt-8 grid gap-8 xl:grid-cols-[1fr_1fr]">
            <div className="glass-panel rounded-[2rem] p-6">
              <h3 className="mb-5 text-xl font-bold text-white">Personalized roadmap</h3>
              <div className="space-y-4">
                {(analysis.roadmap || []).map((week) => (
                  <div key={week.week} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{week.week}</div>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {week.tasks.map((task) => <li key={task} className="flex gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-400" />{task}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <h3 className="mb-5 text-xl font-bold text-white">Recent analyses</h3>
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div>
                      <div className="font-medium text-white">{item.job_title || 'Analysis'}</div>
                      <div className="text-xs text-slate-400">{item.company_name || 'Company'} · {new Date(item.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-300">{Math.round(item.match_score || 0)}%</span>
                      <button className="rounded-lg border border-white/10 p-2 hover:bg-white/5" onClick={() => handleDeleteHistory(item.id)}><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {analysis && (
          <section className="mt-8 glass-panel rounded-[2rem] p-6">
            <h3 className="mb-5 text-xl font-bold text-white">Similarity by skill</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={similarityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="skill" stroke="#94a3b8" angle={-30} textAnchor="end" height={70} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="score" fill="#67e8f9" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
