const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const monthStart = (date) => {
  const value = new Date(date);
  return new Date(value.getFullYear(), value.getMonth(), 1);
};

const addMonths = (date, months) => {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return value;
};

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

const assignmentDistrictId = (assignment) => assignment.districtId || assignment.localBody?.districtId || assignment.district?.id;
const assignmentLocalBodyId = (assignment) => assignment.localBodyId || assignment.localBody?.id;
const assignmentPlaceName = (assignment) => assignment.localBodyName || assignment.localBody?.localBodyName || assignment.placeName || '';
const assignmentCycle = (assignment) => assignment.visitCycle || 'Quarterly';

export const getEmployeeAssignedDistricts = (assignments, employeeId) => {
  const districts = new Map();
  assignments
    .filter((assignment) => assignment.employeeId === employeeId && assignment.active !== false)
    .forEach((assignment) => {
      const districtId = assignmentDistrictId(assignment);
      if (districtId && !districts.has(districtId)) {
        districts.set(districtId, assignment.district || {
          id: districtId,
          districtName: assignment.districtName || assignment.localBody?.districtName || 'Unassigned district',
        });
      }
    });
  return [...districts.values()];
};

export const getEmployeeAssignedLocalBodies = (assignments, employeeId) => assignments
  .filter((assignment) => assignment.employeeId === employeeId && assignment.active !== false)
  .filter((assignment, index, rows) => {
    const localBodyId = assignmentLocalBodyId(assignment);
    return localBodyId && rows.findIndex((candidate) => assignmentLocalBodyId(candidate) === localBodyId) === index;
  });

const cycleStart = (currentDate, visitCycle) => {
  const current = new Date(currentDate);
  if (visitCycle === 'Monthly') return monthStart(current);
  if (visitCycle === 'Bi-Monthly') return addMonths(monthStart(current), -1);
  return addMonths(monthStart(current), -2);
};

const completedPlanForAssignment = (plans, employeeId, assignment, periodStart, periodEnd) => plans.some((plan) => {
  const place = String(plan.area || plan.city || '').trim().toLocaleLowerCase();
  const assignmentPlace = assignmentPlaceName(assignment).trim().toLocaleLowerCase();
  const visitDate = new Date(plan.visitDate);
  return plan.employeeId === employeeId
    && normalizeStatus(plan.status) === 'completed'
    && place === assignmentPlace
    && visitDate >= periodStart
    && visitDate <= periodEnd;
});

export const getTerritoryCoverage = (assignments, plans, employeeId, period = 'cycle', currentDate = new Date()) => {
  const activeAssignments = getEmployeeAssignedLocalBodies(assignments, employeeId);
  const start = period === 'monthly' ? monthStart(currentDate) : addMonths(monthStart(currentDate), -11);
  const dueAssignments = period === 'all-time'
    ? activeAssignments
    : activeAssignments.filter((assignment) => period === 'monthly' || cycleStart(currentDate, assignmentCycle(assignment)) <= currentDate);
  const completed = dueAssignments.filter((assignment) => completedPlanForAssignment(plans, employeeId, assignment, start, currentDate));
  return {
    label: period === 'monthly' ? 'Monthly coverage' : period === 'all-time' ? 'All-time coverage' : 'Cycle coverage',
    due: dueAssignments.length,
    completed: completed.length,
    percentage: dueAssignments.length ? Math.round((completed.length / dueAssignments.length) * 100) : 0,
  };
};

export const getDistrictCoverage = (assignments, plans, employeeId, districtId, period = 'cycle', currentDate = new Date()) => getTerritoryCoverage(
  getEmployeeAssignedLocalBodies(assignments, employeeId).filter((assignment) => assignmentDistrictId(assignment) === districtId),
  plans,
  employeeId,
  period,
  currentDate,
);

export const getDueLocationsByVisitCycle = (assignments, plans, employeeId, currentDate = new Date()) => getEmployeeAssignedLocalBodies(assignments, employeeId)
  .filter((assignment) => {
    const lastCompleted = plans
      .filter((plan) => plan.employeeId === employeeId && normalizeStatus(plan.status) === 'completed')
      .filter((plan) => String(plan.area || plan.city || '').trim().toLocaleLowerCase() === assignmentPlaceName(assignment).trim().toLocaleLowerCase())
      .map((plan) => plan.visitDate)
      .filter(Boolean)
      .sort()
      .at(-1);
    return !lastCompleted || new Date(lastCompleted) < cycleStart(currentDate, assignmentCycle(assignment));
  })
  .map((assignment) => ({
    ...assignment,
    districtId: assignmentDistrictId(assignment),
    localBodyId: assignmentLocalBodyId(assignment),
    localBodyName: assignmentPlaceName(assignment),
    visitCycle: assignmentCycle(assignment),
    currentDate: toDateKey(currentDate),
  }));
