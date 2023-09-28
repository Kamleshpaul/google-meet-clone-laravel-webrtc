<?php

namespace App\Http\Controllers;

use App\Events\SendHandShake;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Dashboard');
    }

    public function meeting($id)
    {
        return Inertia::render('Meeting', compact('id'));
    }

    public function handshake(Request $request)
    {
        event(new SendHandShake($request->reciver_id, auth()->id() , $request->data));

        return response([
            "status" => true,
            "message" => "handshake send.."
        ]);
    }
}
