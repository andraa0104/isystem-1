    // ==========================================
    // ENDPOINT UNTUK TAB 2 - MATERIALS DATA
    // ==========================================
    public function getMaterialsData(Request $request)
    {
        $materials = DB::table('tb_penawarandetail as pd')
            ->join('tb_penawaran as p', DB::raw('TRIM(pd.No_penawaran)'), '=', DB::raw('TRIM(p.No_penawaran)'))
            ->select(
                'pd.ID as id_detail',
                'p.No_penawaran as No_Penawaran',
                'p.Tgl_penawaran as Tgl_Penawaran',
                'p.Customer',
                'pd.Material',
                'pd.Qty',
                'pd.Satuan',
                'pd.Harga',
                'pd.Harga_Modal as Harga_modal',
                'pd.Margin',
                'pd.Remark',
                DB::raw('1 as can_delete')
            )
            ->orderBy('p.Tgl_penawaran', 'desc')
            ->orderBy('pd.ID', 'desc')
            ->get();

        return response()->json(['materials' => $materials]);
    }
