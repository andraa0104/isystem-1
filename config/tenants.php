<?php

return [
    'connection' => env('TENANT_DB_CONNECTION', 'mysql'),
    'databases' => [
        'dbsja',
        'dbbbbs',
        'dbstg',
        'dbarm',
        'dbati',
    ],
    'labels' => [
        'dbsja' => 'DB SJA',
        'dbbbbs' => 'DB BBBS',
        'dbstg' => 'DB STG',
        'dbarm' => 'DB ARM',
        'dbati' => 'DB ATI',
    ],
    'companies' => [
        'dbsja' => [
            'name' => 'CV. SEMESTA JAYA ABADI',
            'address' => 'Jalan Sentosa No 31B RT. 35 Kel. Sungai Pinang Dalam Kec. Sungai Pinang ',
            'kota' => 'Kota Samarinda Provinsi Kalimantan Timur',
            'phone' => '0541-771571',
            'email' => 'cs_sja@yahoo.com',
        ],
        'dbstg' => [
            'name' => 'CV. SURYA TEKNIK GEMILANG',
            'address' => 'Jl. Harmoni II (Lingkar Dalam Selatan) RT. 026/002, Pekapuran Raya, Banjarmasin Timur',
            'kota' => 'Kota Banjarmasin Provinsi Kalimantan Selatan',
            'phone' => '0511 - 6783217',
            'email' => '',
        ],
    ],
    'last_online_column' => 'LastOnline',
];
