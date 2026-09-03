import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Truck, Store } from 'lucide-react';
import { useCalendarOrders, CalendarOrder } from '@/hooks/useCalendarOrders';
import { OrderDetailsDialog } from './OrderDetailsDialog';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function DashboardCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState<CalendarOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: orders, isLoading } = useCalendarOrders(currentMonth);

  // Group orders by date
  const ordersByDate = useMemo(() => {
    const grouped: Record<string, CalendarOrder[]> = {};
    orders?.forEach(order => {
      const dateKey = order.delivery_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(order);
    });
    return grouped;
  }, [orders]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { locale: ptBR });
    const endDate = endOfWeek(monthEnd, { locale: ptBR });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleOrderClick = (order: CalendarOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const getChoppSummary = (order: CalendarOrder) => {
    if (!order.order_items?.length) return '';
    
    const totalLiters = order.order_items.reduce((sum, item) => sum + item.quantity_liters, 0);
    const barrelCount = order.order_items.reduce((sum, item) => sum + (item.barrel_quantity || 1), 0);
    
    return `${totalLiters}L (${barrelCount} barris)`;
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendário de Reservas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Hoje
              </Button>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[150px] text-center font-medium">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground">
              Carregando...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {/* Week day headers */}
              {weekDays.map(day => (
                <div 
                  key={day} 
                  className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayOrders = ordersByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div
                    key={idx}
                    className={cn(
                      "bg-card min-h-[100px] p-1 transition-colors",
                      !isCurrentMonth && "bg-muted/50",
                      isToday && "ring-2 ring-primary ring-inset"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-1 px-1",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                    
                    <div className="space-y-1 max-h-[80px] overflow-y-auto">
                      {dayOrders.map(order => (
                        <button
                          key={order.id}
                          onClick={() => handleOrderClick(order)}
                          className={cn(
                            "w-full text-left p-1 rounded text-xs transition-colors",
                            "hover:ring-2 hover:ring-primary/50",
                            order.status === 'agendado' 
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" 
                              : order.status === 'em_andamento'
                              ? "bg-green-500/20 text-green-700 dark:text-green-400"
                              : "bg-blue-500/20 text-blue-700 dark:text-blue-400"
                          )}
                        >
                          <div className="flex items-center gap-1 font-medium truncate">
                            {order.delivery_type === 'entrega' ? (
                              <Truck className="h-3 w-3 flex-shrink-0" />
                            ) : (
                              <Store className="h-3 w-3 flex-shrink-0" />
                            )}
                            <span className="truncate">{order.customers?.full_name?.split(' ')[0]}</span>
                          </div>
                          <div className="text-[10px] opacity-75 truncate">
                            {getChoppSummary(order)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/50"></div>
              <span className="text-muted-foreground">Agendado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50"></div>
              <span className="text-muted-foreground">Em andamento</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50"></div>
              <span className="text-muted-foreground">Finalizado</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Entrega</span>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Retirada</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <OrderDetailsDialog 
        order={selectedOrder} 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
    </>
  );
}
