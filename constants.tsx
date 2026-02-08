import { YEARS, MONTH_NAMES, AnnoDati } from './types';

export const DEFAULT_YEARS_TEMPLATE: AnnoDati[] = YEARS.flatMap((year) =>
    MONTH_NAMES.map((month, index) => ({
        id: parseInt(`${year}${index}`),
        year: year,
        monthIndex: index,
        month: month,
        daysWorked: 0,
        daysVacation: 0,
        ticket: 0,
        note: ''
    }))
);
