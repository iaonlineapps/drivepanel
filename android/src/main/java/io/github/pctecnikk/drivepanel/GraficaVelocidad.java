package io.github.pctecnikk.drivepanel;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

/**
 * Grafica de velocidad en directo, como la de copiar archivos de Windows 11: la zona azul es
 * la velocidad de cada segundo y la linea discontinua, la media. A la izquierda queda la parte
 * ya descargada (segun el %), el resto se va rellenando.
 */
final class GraficaVelocidad extends View {

    private static final int MAX = 120;            // segundos que se ven a la vez
    private final double[] v = new double[MAX];
    private int n;
    private float fraction;                        // 0..1 del total descargado
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint avg = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint grid = new Paint();
    private final Paint done = new Paint();

    GraficaVelocidad(Context c, boolean dark) {
        super(c);
        float d = c.getResources().getDisplayMetrics().density;
        fill.setColor(dark ? 0x553D7BD9 : 0x441A73E8);
        line.setColor(0xFF1A73E8);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeWidth(2 * d);
        avg.setColor(dark ? 0xAAA8ABAF : 0xAA5F6368);
        avg.setStyle(Paint.Style.STROKE);
        avg.setStrokeWidth(d);
        avg.setPathEffect(new android.graphics.DashPathEffect(new float[]{6 * d, 4 * d}, 0));
        grid.setColor(dark ? 0xFF44474A : 0xFFE3E3E3);
        done.setColor(dark ? 0x22FFFFFF : 0x0F1A73E8);
    }

    void reset() {
        n = 0;
        fraction = 0;
        invalidate();
    }

    void add(double bytesPerSecond, float frac) {
        if (n < MAX) v[n++] = bytesPerSecond;
        else {
            System.arraycopy(v, 1, v, 0, MAX - 1);
            v[MAX - 1] = bytesPerSecond;
        }
        fraction = Math.max(0, Math.min(1, frac));
        invalidate();
    }

    @Override
    protected void onDraw(Canvas c) {
        int w = getWidth(), h = getHeight();
        c.drawRect(0, 0, w * fraction, h, done);
        c.drawLine(0, h - 1, w, h - 1, grid);
        c.drawLine(0, 0, w, 0, grid);
        if (n < 2) return;
        double max = 1, sum = 0;
        for (int i = 0; i < n; i++) { max = Math.max(max, v[i]); sum += v[i]; }
        max *= 1.15;
        float step = (float) w / (MAX - 1);
        Path p = new Path();
        Path f = new Path();
        f.moveTo(0, h);
        for (int i = 0; i < n; i++) {
            float x = i * step, y = (float) (h - v[i] / max * h);
            if (i == 0) p.moveTo(x, y); else p.lineTo(x, y);
            f.lineTo(x, y);
        }
        f.lineTo((n - 1) * step, h);
        f.close();
        c.drawPath(f, fill);
        c.drawPath(p, line);
        float ya = (float) (h - (sum / n) / max * h);
        c.drawLine(0, ya, w, ya, avg);
    }
}
