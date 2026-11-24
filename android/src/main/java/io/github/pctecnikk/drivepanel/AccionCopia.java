package io.github.pctecnikk.drivepanel;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Botones "Pausar" y "Cancelar" del aviso de la copia de fotos. */
public class AccionCopia extends BroadcastReceiver {

    static final String PAUSE = "io.github.pctecnikk.drivepanel.COPIA_PAUSAR";
    static final String CANCEL = "io.github.pctecnikk.drivepanel.COPIA_CANCELAR";

    @Override
    public void onReceive(Context c, Intent i) {
        Tr.init(c);
        if (PAUSE.equals(i.getAction())) CopiaFotos.pause(c);
        else if (CANCEL.equals(i.getAction())) CopiaFotos.cancel(c);
    }
}
