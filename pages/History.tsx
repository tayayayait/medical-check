import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Input, Button, Pagination } from '../components/UIComponents';
import { useGlobalData } from '../App';
import { Link } from 'react-router-dom';
import { Search, Download } from 'lucide-react';

export const History: React.FC = () => {
  const { history, isLoading } = useGlobalData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return history.filter(item => {
      const createdAt = new Date(item.createdAt);
      const matchesSearch = term.length === 0
        || item.adName.toLowerCase().includes(term)
        || item.id.toLowerCase().includes(term);
      const matchesRisk = filterRisk === 'all' || item.riskLevel === filterRisk;
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchesStart = start ? createdAt >= start : true;
      const matchesEnd = end ? createdAt <= end : true;
      return matchesSearch && matchesRisk && matchesStatus && matchesStart && matchesEnd;
    });
  }, [history, searchTerm, filterRisk, filterStatus, startDate, endDate]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const pagedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, page]);

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
    if (totalPages === 0 && page !== 1) {
      setPage(1);
    }
  }, [page, totalPages]);

  const riskLabel = (value: string) => value === 'high' ? '고위험' : value === 'medium' ? '중위험' : '저위험';
  const statusLabel = (value: string) => {
    switch (value) {
      case 'queued': return '대기';
      case 'running': return '분석 중';
      case 'done': return '완료';
      case 'failed': return '실패';
      default: return value;
    }
  };

  const handleExportCsv = () => {
    const header = ['ID', 'Date', 'AdName', 'PassScore', 'RiskLevel', 'Status'];
    const rows = filteredData.map((item) => [
      item.id,
      new Date(item.createdAt).toISOString(),
      item.adName,
      item.passScore.toString(),
      item.riskLevel,
      item.status
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `analysis-history-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">분석 이력</h1>
        <span className="text-sm text-text-secondary">검색 결과 {filteredData.length}건</span>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary w-4 h-4" />
              <Input 
                className="pl-10" 
                placeholder="광고명 또는 ID로 검색..." 
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select 
                className="h-9 rounded-md border border-border px-3 bg-white text-sm focus:ring-1 focus:ring-primary"
                value={filterRisk}
                onChange={(e) => {
                  setFilterRisk(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">모든 위험도</option>
                <option value="high">고위험</option>
                <option value="medium">중위험</option>
                <option value="low">저위험</option>
              </select>
              <select 
                className="h-9 rounded-md border border-border px-3 bg-white text-sm focus:ring-1 focus:ring-primary"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">모든 상태</option>
                <option value="queued">대기</option>
                <option value="running">분석 중</option>
                <option value="done">완료</option>
                <option value="failed">실패</option>
              </select>
              <Button variant="secondary" className="whitespace-nowrap" onClick={handleExportCsv}>
                <Download size={16} /> CSV 내보내기
              </Button>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <div className="flex flex-col md:flex-row gap-3">
              <Input
                type="date"
                label="시작일"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                type="date"
                label="종료일"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-text-secondary font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">날짜</th>
                <th className="px-6 py-4">광고명</th>
                <th className="px-6 py-4">통과 점수</th>
                <th className="px-6 py-4">위험도</th>
                <th className="px-6 py-4">상태</th>
                <th className="px-6 py-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : pagedData.length > 0 ? (
                pagedData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-text-secondary font-mono text-xs">{item.id}</td>
                    <td className="px-6 py-4 text-text-secondary">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-medium text-text-primary">{item.adName}</td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 w-24 mb-1">
                        <div 
                          className={`h-1.5 rounded-full ${item.passScore > 70 ? 'bg-risk-low' : 'bg-risk-high'}`} 
                          style={{ width: `${item.passScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">{item.passScore}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={item.riskLevel} label={riskLabel(item.riskLevel)} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-secondary">{statusLabel(item.status)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/analysis/${item.id}`}>
                        <Button variant="secondary" className="h-8 text-xs">상세 보기</Button>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-secondary">
                    조건에 맞는 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
      />
    </div>
  );
};
