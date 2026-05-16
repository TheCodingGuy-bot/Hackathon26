import { useEffect, useState, useCallback } from 'react';
import { usePhantom } from '../../context/PhantomContext';
import Layout from '../../components/Layout';
import { getDisputedProjectsApi, resolveDisputeApi } from '../../api/projects';
import type { Project } from '../../types';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Wallet, ExternalLink, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

// Program ID - update after deploying
const PROGRAM_ID = '6NikvvCPKpAkbdXWg8NtNes77mno854GjCouQqmkgyBS';

interface Dispute {
  project: Project;
  milestoneId: number;
  milestoneTitle: string;
  status: 'IN_DISPUTE' | 'RESOLVED';
  submission?: {
    githubRepo?: string;
    demoLink?: string;
    notes?: string;
  };
}

export default function JudgeDashboard() {
  const { address, connect, isPhantomInstalled, connecting } = usePhantom();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const loadDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const projects = await getDisputedProjectsApi();
      
      // Filter milestones in AI_REVIEW status
      const disputeList: Dispute[] = [];
      for (const project of projects) {
        for (const milestone of project.milestones) {
          if (milestone.status === 'AI_REVIEW' || milestone.status === 'IN_DISPUTE') {
            disputeList.push({
              project,
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              status: 'IN_DISPUTE',
              submission: milestone.submission,
            });
          }
        }
      }
      
      setDisputes(disputeList);
    } catch (err) {
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  const handleDecision = async (dispute: Dispute, approved: boolean) => {
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    setProcessing(dispute.milestoneId);
    try {
      // Call backend which will record on Solana
      await resolveDisputeApi(dispute.milestoneId, approved);

      // Update local state
      setDisputes((prev) =>
        prev.map((d) =>
          d.milestoneId === dispute.milestoneId
            ? { ...d, status: 'RESOLVED' as const }
            : d
        )
      );

      toast.success(
        approved
          ? '✓ Approved - Funds released to freelancer'
          : '✗ Rejected - Funds returned to contractor'
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit decision');
    } finally {
      setProcessing(null);
    }
  };

  const formatSol = (lamports: number) => {
    // Assuming amount is already in USD but convert for display
    return (lamports / 1000000000).toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_CLIENT': return 'text-yellow-400 bg-yellow-400/15';
      case 'ACTIVE': return 'text-blue-400 bg-blue-400/15';
      case 'FUNDED': return 'text-green-400 bg-green-400/15';
      case 'IN_PROGRESS': return 'text-purple-400 bg-purple-400/15';
      case 'COMPLETED': return 'text-green-500 bg-green-500/15';
      case 'DECLINED': return 'text-red-400 bg-red-400/15';
      default: return 'text-slate-400 bg-slate-400/15';
    }
  };

  const getMilestoneStatusLabel = (status: string) => {
    switch (status) {
      case 'AI_REVIEW': return 'NEEDS JUDGMENT';
      case 'AI_APPROVED': return 'APPROVED';
      case 'AI_REJECTED': return 'REJECTED';
      case 'SUBMITTED': return 'PENDING CLIENT';
      case 'CLIENT_APPROVED': return 'CLIENT APPROVED';
      case 'IN_PROGRESS': return 'IN PROGRESS';
      case 'COMPLETED': return 'COMPLETED';
      default: return status;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-400" size={24} />
              AI Judge Dashboard
            </h1>
            <p className="text-slate-400 mt-1">
              Review disputed milestones and make on-chain decisions
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadDisputes()}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            {!address ? (
              <button
                onClick={() => void connect()}
                disabled={connecting || !isPhantomInstalled}
                className="btn-primary flex items-center gap-2"
              >
                <Wallet size={18} />
                {connecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-950/40 border border-green-500/30 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm text-green-300">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
          <Eye size={20} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-200">Blockchain Verification</p>
            <p className="text-sm text-blue-300 mt-0.5">
              All decisions are recorded on Solana for transparency. Program ID: <code className="text-blue-100">{PROGRAM_ID}</code>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-amber-400/15 rounded-xl mx-auto mb-2">
              <AlertTriangle size={22} className="text-amber-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {disputes.filter((d) => d.status === 'IN_DISPUTE').length}
            </p>
            <p className="text-sm text-slate-400">Pending Disputes</p>
          </div>
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-400/15 rounded-xl mx-auto mb-2">
              <CheckCircle size={22} className="text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {disputes.filter((d) => d.status === 'RESOLVED').length}
            </p>
            <p className="text-sm text-slate-400">Resolved</p>
          </div>
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-400/15 rounded-xl mx-auto mb-2">
              <Eye size={22} className="text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              {disputes.length}
            </p>
            <p className="text-sm text-slate-400">Total Projects</p>
          </div>
          <div className="card text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-escrow-sea/15 rounded-xl mx-auto mb-2">
              <Wallet size={22} className="text-escrow-sea" />
            </div>
            <p className="text-3xl font-bold text-white">
              {formatSol(disputes.reduce((sum, d) => sum + d.project.budget, 0))}
            </p>
            <p className="text-sm text-slate-400">Total Value</p>
          </div>
        </div>

        {/* Disputes List */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">
            <RefreshCw size={32} className="animate-spin mx-auto mb-3" />
            Loading disputes from blockchain...
          </div>
        ) : disputes.length === 0 ? (
          <div className="card text-center py-20">
            <CheckCircle size={48} className="text-green-400/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-200">All Caught Up!</h3>
            <p className="text-slate-400 mt-1">No pending disputes to review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <div
                key={`${dispute.project.id}-${dispute.milestoneId}`}
                className={`card border-l-4 ${
                  dispute.status === 'IN_DISPUTE'
                    ? 'border-l-amber-400'
                    : 'border-l-green-400'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        dispute.status === 'IN_DISPUTE'
                          ? 'bg-amber-400/20 text-amber-400'
                          : 'bg-green-400/20 text-green-400'
                      }`}>
                        {dispute.status === 'IN_DISPUTE' ? 'REVIEW NEEDED' : 'RESOLVED'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(dispute.project.status)}`}>
                        {dispute.project.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Project & Milestone */}
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {dispute.project.title}
                    </h3>
                    <p className="text-slate-400 text-sm mb-3">
                      Milestone: <span className="text-escrow-aqua font-medium">{dispute.milestoneTitle}</span>
                    </p>

                    {/* Budget */}
                    <div className="flex items-center gap-2 mb-4">
                      <div className="px-3 py-1.5 bg-escrow-aqua/10 border border-escrow-aqua/30 rounded-lg">
                        <span className="text-lg font-bold text-escrow-aqua">
                          ${dispute.project.budget.toLocaleString()}
                        </span>
                        <span className="text-xs text-escrow-aqua/70 ml-1">USDC</span>
                      </div>
                    </div>

                    {/* Submission Details */}
                    {dispute.submission && (
                      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Freelancer Submission</h4>
                        {dispute.submission.githubRepo && (
                          <a
                            href={dispute.submission.githubRepo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-escrow-aqua hover:underline mb-1"
                          >
                            <ExternalLink size={14} />
                            GitHub: {dispute.submission.githubRepo}
                          </a>
                        )}
                        {dispute.submission.demoLink && (
                          <a
                            href={dispute.submission.demoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-escrow-aqua hover:underline mb-1"
                          >
                            <ExternalLink size={14} />
                            Demo: {dispute.submission.demoLink}
                          </a>
                        )}
                        {dispute.submission.notes && (
                          <p className="text-sm text-slate-400 mt-2">{dispute.submission.notes}</p>
                        )}
                      </div>
                    )}

                    {/* Parties */}
                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span>
                        Developer: <span className="text-slate-300">{dispute.project.developer.fullName}</span>
                      </span>
                      <span>
                        Client: <span className="text-slate-300">{dispute.project.client?.fullName || dispute.project.clientEmail}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {dispute.status === 'IN_DISPUTE' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleDecision(dispute, true)}
                        disabled={processing === dispute.milestoneId || !address}
                        className="btn-success flex items-center gap-2 px-6"
                      >
                        {processing === dispute.milestoneId ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(dispute, false)}
                        disabled={processing === dispute.milestoneId || !address}
                        className="btn-danger flex items-center gap-2 px-6"
                      >
                        {processing === dispute.milestoneId ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <XCircle size={16} />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                  {dispute.status === 'RESOLVED' && (
                    <div className="text-green-400 font-medium flex items-center gap-2">
                      <CheckCircle size={20} />
                      Resolved
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <h4 className="font-medium text-slate-200 mb-2">How AI Judge Decisions Work</h4>
          <ol className="text-sm text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-escrow-sea/20 text-escrow-sea rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <span>Client rejects milestone → moves to AI_REVIEW status</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-escrow-sea/20 text-escrow-sea rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <span>AI Judge reviews submission details (code, demo, notes)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-escrow-sea/20 text-escrow-sea rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <span><strong className="text-escrow-aqua">Approve</strong> → Transaction on Solana releases funds to freelancer</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 bg-escrow-sea/20 text-escrow-sea rounded-full flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <span><strong className="text-amber-400">Reject</strong> → Transaction returns funds to contractor</span>
            </li>
          </ol>
        </div>
      </div>
    </Layout>
  );
}