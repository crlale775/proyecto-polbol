<?php

use Illuminate\Support\Facades\Route;

// Rutas web principales que cargan la interfaz React (SPA)
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
