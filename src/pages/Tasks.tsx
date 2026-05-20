import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, CircleCheck as CheckCircle, Circle, Clock, CircleAlert as AlertCircle, Eye, Play } from 'lucide-react';
import { QuickActionModal, QuickIconButton } from '@/components/ats/QuickActionModal';
import { LOCAL_TASKS_KEY, readLocalRows, saveRows } from '@/lib/atsApi';
import { getAllTasks } from '@/lib/localRecords';
import type { Priority, Task, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const priorityColors: Record<Priority, string> = {
  Critical: 'text-red-400',
  High: 'text-orange-400',
  Medium: 'text-yellow-400',
  Low: 'text-slate-400',
};

const priorityDot: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-slate-500',
};

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  Pending: <Circle size={15} className="text-slate-500" />,
  'In Progress': <Clock size={15} className="text-blue-400" />,
  Completed: <CheckCircle size={15} className="text-emerald-400" />,
  Overdue: <AlertCircle size={15} className="text-red-400" />,
};

const categories = ['All', 'Follow-up', 'Sourcing', 'Compliance', 'Business Dev', 'Admin', 'Contract', 'Prep', 'Marketing'];

export default function Tasks() {
  const [taskRows, setTaskRows] = useState<Task[]>(() => {
    const saved = readLocalRows<Task>(LOCAL_TASKS_KEY);
    return saved.length ? saved : getAllTasks();
  });
  const [filter, setFilter] = useState<TaskStatus | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [taskAction, setTaskAction] = useState<null | { type: 'details' | 'start' | 'complete'; task: Task }>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(taskRows.filter(t => t.status === 'Completed').map(t => t.id))
  );

  const filtered = taskRows.filter(t => {
    const matchStatus = filter === 'All' || t.status === filter;
    const matchCategory = categoryFilter === 'All' || t.category === categoryFilter;
    return matchStatus && matchCategory;
  });

  const toggleComplete = (id: string) => {
    const nextRows = taskRows.map(task => task.id === id ? { ...task, status: completedIds.has(id) ? 'Pending' : 'Completed' as TaskStatus } : task);
    setTaskRows(nextRows);
    saveRows('tasks', nextRows);
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function updateTaskStatus(taskId: string, status: TaskStatus) {
    const nextRows = taskRows.map(task => task.id === taskId ? { ...task, status } : task);
    setTaskRows(nextRows);
    saveRows('tasks', nextRows);
    setCompletedIds(new Set(nextRows.filter(task => task.status === 'Completed').map(task => task.id)));
  }

  const pendingCount = taskRows.filter(t => t.status !== 'Completed').length;
  const completedCount = taskRows.filter(t => t.status === 'Completed').length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">{pendingCount} pending · {completedCount} completed</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} />
          Add Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', count: taskRows.length, color: 'text-white' },
          { label: 'Critical', count: taskRows.filter(t => t.priority === 'Critical').length, color: 'text-red-400' },
          { label: 'In Progress', count: taskRows.filter(t => t.status === 'In Progress').length, color: 'text-blue-400' },
          { label: 'Completed', count: completedIds.size, color: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#0d1729] border border-white/5 rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold', s.color)}>{s.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Filters */}
        <div className="space-y-3">
          <div className="bg-[#0d1729] border border-white/5 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Status</p>
            {(['All', 'Pending', 'In Progress', 'Completed', 'Overdue'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors mb-1 text-left',
                  filter === s ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {s !== 'All' && statusIcons[s as TaskStatus]}
                {s === 'All' && <span className="w-[15px]" />}
                {s}
              </button>
            ))}
          </div>

          <div className="bg-[#0d1729] border border-white/5 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Category</p>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-xs transition-colors mb-1 text-left',
                  categoryFilter === c ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        <div className="lg:col-span-3 space-y-2">
          {filtered.map((task, i) => {
            const isDone = completedIds.has(task.id);
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'bg-[#0d1729] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all group',
                  isDone && 'opacity-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(task.id)}
                    className="mt-0.5 flex-shrink-0 transition-transform active:scale-90"
                  >
                    {isDone
                      ? <CheckCircle size={18} className="text-emerald-400" />
                      : <Circle size={18} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className={cn('text-sm font-medium', isDone ? 'line-through text-slate-600' : 'text-white')}>
                        {task.title}
                      </p>
                      <div className={cn('w-1.5 h-1.5 rounded-full', priorityDot[task.priority])} />
                      <span className={cn('text-[10px] font-medium', priorityColors[task.priority])}>
                        {task.priority}
                      </span>
                      <span className="text-[10px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded-full">{task.category}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{task.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-600 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock size={9} />
                        Due {task.dueDate}
                      </div>
                      <span>· {task.assignee}</span>
                      {task.relatedTo && (
                        <span className="text-blue-400/70">· {task.relatedType}: {task.relatedTo}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <QuickIconButton title="Task details" onClick={() => setTaskAction({ type: 'details', task })}><Eye size={14} /></QuickIconButton>
                    <QuickIconButton title="Start task" onClick={() => setTaskAction({ type: 'start', task })}><Play size={14} /></QuickIconButton>
                    <QuickIconButton title="Complete task" onClick={() => setTaskAction({ type: 'complete', task })}><CheckCircle size={14} /></QuickIconButton>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {taskAction && (
        <QuickActionModal
          title={taskAction.type === 'details' ? 'Task Details' : taskAction.type === 'start' ? 'Start Task' : 'Complete Task'}
          subtitle={`${taskAction.task.title} - ${taskAction.task.assignee}`}
          onCancel={() => setTaskAction(null)}
          onSave={taskAction.type === 'details' ? undefined : () => {
            updateTaskStatus(taskAction.task.id, taskAction.type === 'start' ? 'In Progress' : 'Completed');
            setTaskAction(null);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="Status" value={taskAction.task.status} />
            <Info label="Priority" value={taskAction.task.priority} />
            <Info label="Category" value={taskAction.task.category} />
            <Info label="Due date" value={taskAction.task.dueDate} />
          </div>
          <p className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">{taskAction.task.description}</p>
        </QuickActionModal>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
